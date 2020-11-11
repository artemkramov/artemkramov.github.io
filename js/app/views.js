const { View, CollectionView, Region } = Marionette;

/**
 * Header view for loading of text from external file
 * @type {void|*}
 */
var HeaderLoadFileView = View.extend({
    template: _.template($("#header-load-file-template").html()),
    events: {
        "submit #form-select-file": "onFileSelectSubmit",
        "click .button-process-text": "onBtnProcessText",
        "click #btn-reset": "onBtnReset"
    },
    /**
     * Load text from file
     * @param e
     * @returns {boolean}
     */
    onFileSelectSubmit: function (e) {
        /**
         * Select file
         */
        let file = $(e.target).find("#file-select").prop("files")[0];
        if (!file) {
            return;
        }

        /**
         * Load file via FileReader in async manner and trigger event
         */
        let reader = new FileReader();
        reader.onload = function (e) {
            let contents = e.target.result;
            basicRadioChannel.trigger(basicRadioChannelEvents.radioEventFileSelected, contents);
        };
        reader.readAsText(file);
        return false;
    },
    /**
     * Process text
     * @param e
     */
    onBtnProcessText: function (e) {
        let self = this;
        let button = $(e.target);
        let action = $(button).data('action');
        let text = basicRadioChannel.request(basicRadioChannelEvents.radioEventFileGetText);
        basicRadioChannel.trigger(basicRadioChannelEvents.radioEventPreloaderShow);
        let data = {
            'text': text
        };
        let url = 'url' + action;
        this.model.sendJSONRequest(self.model.get(url), {
            data: JSON.stringify(data)
        }).done(function (response) {
            response.text = text
            basicRadioChannel.trigger(basicRadioChannelEvents.radioEventPageChange, action, response);
        }).fail(function () {
            basicRadioChannel.trigger(basicRadioChannelEvents.radioEventNotification, "Помилка запиту до серверу", "error");
        }).always(function () {
            basicRadioChannel.trigger(basicRadioChannelEvents.radioEventPreloaderHide);
        });
    },
    /**
     * Reset all clusters and text
     */
    onBtnReset: function () {
        basicRadioChannel.trigger(basicRadioChannelEvents.radioEventPageChange, "textbox");
    },

    /**
     * Send text for recognition of tokens and named entities
     */
    onBtnRecognize: function () {
        let text = basicRadioChannel.request(basicRadioChannelEvents.radioEventFileGetText);
        basicRadioChannel.trigger(basicRadioChannelEvents.radioEventPreloaderShow);
        this.model.extractEntitiesFromText(text).done(function (parsedData) {
            basicRadioChannel.trigger(basicRadioChannelEvents.radioEventPageChange, "parsed", parsedData);
        }).fail(function (errorMessage) {
            basicRadioChannel.trigger(basicRadioChannelEvents.radioEventNotification, errorMessage, "error");
        }).always(function () {
            basicRadioChannel.trigger(basicRadioChannelEvents.radioEventPreloaderHide);
        });
    }
});

/**
 * Header view for pushing of entities to clusters and saving all changes
 * @type {void|*}
 */
var HeaderSaveClustersView = View.extend({
    template: _.template($("#header-save-clusters-template").html()),

    initialize: function () {
        /**
         * Listen to the change of clusters for the re-rendering of dropdown
         */
        this.listenTo(this.model, 'change:clusters', this.render);

        basicRadioChannel.on(basicRadioChannelEvents.radioEventClusterSizeChange, this.onClusterSizeChange, this);
    },
    onBeforeDestroy() {
        basicRadioChannel.off(basicRadioChannelEvents.radioEventClusterSizeChange, this.onClusterSizeChange, this);
    },
    onClusterSizeChange: function (clusters) {
        this.model.set('clusters', clusters);
    },
    events: {
        "click #btn-reset": "onBtnReset",
        "click #btn-add-to-cluster": "onBtnAddToCluster",
        "click #btn-save-clusters": "onBtnSaveClusters"
    },
    /**
     * Reset all clusters and text
     */
    onBtnReset: function () {
        if (confirm('Are you sure you want to reset all?')) {
            basicRadioChannel.trigger(basicRadioChannelEvents.radioEventPageChange, "textbox");
        }
    },
    /**
     * Add entities to the cluster
     */
    onBtnAddToCluster: function () {
        /**
         * Get selected entities
         */
        let selectedTokens = basicRadioChannel.request(basicRadioChannelEvents.radioEventEntityGetSelected);

        /**
         * Get selected cluster
         */
        let clusterID = this.$el.find('#select-cluster').val();

        /**
         * Push event with retrieved data
         */
        if (_.isEmpty(selectedTokens)) {
            basicRadioChannel.trigger(basicRadioChannelEvents.radioEventNotification, "Cluster cannot be empty!", "error");
        }
        else {
            basicRadioChannel.trigger(basicRadioChannelEvents.radioEventEntityAddToCluster, {
                clusterID: clusterID,
                selectedTokens: selectedTokens
            });
            this.$el.find("#select-cluster").prop('selectedIndex', 0);
        }
    },
    /**
     * Save current clusters
     */
    onBtnSaveClusters: function () {
        if (confirm('Save formed clusters?')) {
            /**
             * Get all tokens
             */
            let tokens = basicRadioChannel.request(basicRadioChannelEvents.radioEventEntityRetrieve);
            basicRadioChannel.trigger(basicRadioChannelEvents.radioEventPreloaderShow);

            /**
             * Call model method to save all tokens
             */
            this.model.saveTokens(tokens).done(function () {
                basicRadioChannel.trigger(basicRadioChannelEvents.radioEventPageChange, "textbox");
                basicRadioChannel.trigger(basicRadioChannelEvents.radioEventNotification, "Cluster was saved successfully", "success");
            }).fail(function (errorMessage) {
                basicRadioChannel.trigger(basicRadioChannelEvents.radioEventNotification, errorMessage, "error");
            }).always(function () {
                basicRadioChannel.trigger(basicRadioChannelEvents.radioEventPreloaderHide);
            });
        }
    }
});

/**
 * General header view
 * @type {void|*}
 */
var HeaderView = View.extend({
    template: _.template($("#header-template").html()),

    /**
     * Current content page of header
     */
    activePage: "textbox", // or "parsed"
    regions: {
        "content": ".header-inputs-wrapper"
    },
    initialize: function () {
        basicRadioChannel.on(basicRadioChannelEvents.radioEventPageChange, this.onPageChange, this);
    },
    /**
     * Process event when content page is changed
     * @param page
     */
    onPageChange: function (page) {
        this.activePage = page;
        this.render();
    },
    onRender() {
        let self = this;
        let element = this.regions['content'];
        this.model.set('clusters', []);

        /**
         * Switch between different content pages
         * due to the activePage attribute
         */
        switch (this.activePage) {
            case "textbox":
                self.showChildView('content', new HeaderLoadFileView({
                    'el': element,
                    model: self.model
                }).render());
                break;
            case "parsed":
                self.showChildView('content', new HeaderSaveClustersView({
                    'el': element,
                    model: self.model
                }).render());
                break;
            default:
                self.showChildView('content', new HeaderLoadFileView({
                    'el': element,
                    model: self.model
                }).render());
                break;
        }
    },
    onBeforeDestroy() {
        basicRadioChannel.off(basicRadioChannelEvents.radioEventPageChange, this.onPageChange, this);
    }
});

/**
 * View which represent the entire cluster
 * @type {void|*}
 */
var ClusterView = View.extend({
    template: _.template($("#cluster-template").html()),
    events: {
        "click .btn-remove-cluster": "onBtnRemoveCluster",
        "click .btn-remove-cluster-item": "onBtnRemoveClusterItem"
    },
    initialize() {
        basicRadioChannel.on(basicRadioChannelEvents.radioEventEntityRemoveFromCluster, this.onEntityRemoveFromCluster, this);

        /**
         * Re-render view on model attribute changes
         */
        this.listenTo(this.model, 'change', this.render);
    },
    onBeforeDestroy() {
        basicRadioChannel.off(basicRadioChannelEvents.radioEventEntityRemoveFromCluster, this.onEntityRemoveFromCluster, this);
    },
    /**
     * Remove current cluster
     */
    onBtnRemoveCluster: function () {
        /**
         * Remove chosen label from all tokens of cluster
         */
        _.each(this.model.get('tokens'), function (token) {
            token.set('clusterID', null);
        });
        this.model.collection.remove(this.model);
    },
    /**
     * Remove entity by the given ID of cluster
     * @param entityNumber
     * @param clusterID
     */
    onEntityRemoveFromCluster: function (entityNumber, clusterID) {
        if (this.model.id == clusterID) {
            /**
             * Find necessary entity
             * and remove it from cluster
             */
            let tokenNumber = this.model.get('tokens').findIndex(function (token) {
                return token.get('entityNumber') == entityNumber
            });
            if (tokenNumber > -1) {
                this.removeClusterItem(tokenNumber);
            }
        }
    },
    /**
     * Remove entity from cluster by the given index
     * @param tokenNumber
     */
    removeClusterItem: function (tokenNumber) {
        /**
         * Get token by its index
         */
        let token = this.model.get('tokens')[tokenNumber];

        /**
         * Remove token from collection of cluster
         */
        this.model.get('tokens').splice(tokenNumber, 1);
        this.model.set('tokens', this.model.get('tokens'));

        /**
         * Clear token corresponding attribute
         */
        token.set('clusterID', null);

        /**
         * If cluster doesn't have any other entities
         * than remove the whole cluster
         * else re-render the view
         */
        if (this.model.get('tokens').length == 0) {
            this.onBtnRemoveCluster();
        }
        else {
            this.render();
        }
    },
    /**
     * Remove cluster item
     * @param e
     */
    onBtnRemoveClusterItem: function (e) {
        let tokenNumber = parseInt($(e.currentTarget).data('token'));
        this.removeClusterItem(tokenNumber);
    }
});

/**
 * Empty view for sidebar if no clusters is present
 * @type {void|*}
 */
var SidebarEmptyView = View.extend({
    template: _.template($("#sidebar-empty-template").html())
});

/**
 * Sidebar view which contains collection of clusters
 * @type {void|*}
 */
var SidebarView = CollectionView.extend({
    template: _.template($("#sidebar-template").html()),
    childView: ClusterView,
    childViewContainer: "#clusters-wrapper",
    //emptyView: SidebarEmptyView,
    initialize() {

        /**
         * Listen to global events
         */
        basicRadioChannel.on(basicRadioChannelEvents.radioEventEntityAddToCluster, this.onEntityToClusterAdd, this);
        basicRadioChannel.on(basicRadioChannelEvents.radioEventPageChange, this.onPageChange, this);

        /**
         * Listen to the changes on the collection
         */
        this.listenTo(this.collection, 'add', this.render);
        this.listenTo(this.collection, 'remove', this.render);
        this.listenTo(this.collection, 'reset', this.render);

        this.listenTo(this.collection, 'add', this.onCollectionSizeChange);
        this.listenTo(this.collection, 'remove', this.onCollectionSizeChange);
        this.listenTo(this.collection, 'reset', this.onCollectionSizeChange);
    },
    onCollectionSizeChange: function () {
        /**
         * Trigger global events in case of the change of the collection's size
         * It is necessary for updating of the dropdown with clusters
         */
        basicRadioChannel.trigger(basicRadioChannelEvents.radioEventClusterSizeChange, this.collection.toJSON());
    },
    onBeforeDestroy() {
        basicRadioChannel.off(basicRadioChannelEvents.radioEventEntityAddToCluster, this.onEntityToClusterAdd, this);
        basicRadioChannel.off(basicRadioChannelEvents.radioEventPageChange, this.onPageChange, this);
    },
    /**
     * Reset collection if the page becomes "textbox"
     * @param page
     */
    onPageChange: function (page) {
        if (page == "textbox") {
            this.collection.reset();
        }
    },
    /**
     * Process event which is passed from external view
     * Add entity to the cluster
     * @param data
     */
    onEntityToClusterAdd: function (data) {
        let cluster = null;

        /**
         * Check if new cluster should be created
         */
        if (_.isEmpty(data.clusterID)) {

            let newClusterID = 0;

            if (this.collection.length > 0) {
                /**
                 * Find the largest ID and create cluster with it
                 */
                let lastCluster = this.collection.max(function (item) {
                    return item.get('id');
                });
                newClusterID = lastCluster.get('id') + 1;
            }
            data.clusterID = newClusterID;

            /**
             * Create new cluster
             */
            cluster = this.collection.add({
                name: 'Cluster #' + data.clusterID.toString(),
                tokens: [],
                id: data.clusterID
            });
        }
        else {
            /**
             * Get cluster by the attribute 'id'
             */
            cluster = this.collection.get(data.clusterID);
        }
        /**
         * Set clusterID attribute for selected tokens and deselect them
         */
        data.selectedTokens.map(token => token.set({clusterID: cluster.get('id'), isSelected: false}));

        /**
         * Set tokens for the cluster by the merging with presented tokens
         */
        cluster.set('tokens', cluster.get('tokens').concat(data.selectedTokens));
    }
});

/**
 * View for displaying of token
 * @type {void|*}
 */
var PageParsedTokenView = View.extend({
    template: _.template($("#page-parsed-token-template").html()),
    tagName: 'span',
    initialize: function () {
        this.listenTo(this.model, 'change', this.render);
    }
});

var PageCoherenceView = CollectionView.extend({
    template: _.template($("#page-coherence-template").html()),
    initialize() {

        /**
         * Listen to global events
         * And return necessary information for it
         */
        basicRadioChannel.on(basicRadioChannelEvents.radioEventPageChange, this.onPageChange, this);

    },

    /**
     * Reset collection on the page change event
     */
    onPageChange: function () {
    }
});

var PageCoreferentTokenItemView = View.extend({
    template: _.template($("#page-coreferent-token-template").html()),
    tagName: 'span'
});

var PageCoreferentTokensView = CollectionView.extend({
    template: _.template($("#page-coreferent-tokens-template").html()),
    childView: PageCoreferentTokenItemView,
    childViewContainer: '#page-coreferent-tokens-wrapper',
    initialize() {

        /**
         * Listen to global events
         * And return necessary information for it
         */
        basicRadioChannel.on(basicRadioChannelEvents.radioEventPageChange, this.onPageChange, this);

        basicRadioChannel.on(basicRadioChannelEvents.radioEventClusterSelectDeselect, this.onClusterSelectDeselect, this);

    },
    onClusterSelectDeselect: function (cluster, status) {
        let self = this;
        _.each(cluster, function (group) {
             _.each(group, function (wordPosition) {
                 self.collection.at(wordPosition).set('Status', status);
             });
        });
        self.render();
        //console.log(cluster);
    },
    /**
     * Reset collection on the page change event
     */
    onPageChange: function () {
        this.collection.reset();
    },
    onBeforeDestroy: function () {
        basicRadioChannel.off(basicRadioChannelEvents.radioEventClusterSelectDeselect, this.onClusterSelectDeselect, this);
        basicRadioChannel.off(basicRadioChannelEvents.radioEventPageChange, this.onPageChange, this);
    }
});

var PageCoreferentClusterView = View.extend({
    template: _.template($("#page-coreferent-cluster-template").html()),
    tagName: 'tr',
    events: {
        'click .btn-select-cluster': 'onClusterSelectClick',
        'click .btn-deselect-cluster': 'onClusterDeselectClick'
    },
    initialize: function () {

        /**
         * Listen to the change of clusters for the re-rendering of dropdown
         */
        this.listenTo(this.model, 'change:state', this.render);

    },
    switchClusterSelection: function (state) {
        let cluster = this.model.get('cluster');
        basicRadioChannel.trigger(basicRadioChannelEvents.radioEventClusterSelectDeselect, cluster, state);
        this.model.set('state', state);
    },
    onClusterDeselectClick: function () {
        this.switchClusterSelection(0);
    },
    onClusterSelectClick: function (e) {
        this.switchClusterSelection(1);
    }
});

var PageCoreferentGroupView = CollectionView.extend({
    template: _.template($("#page-coreferent-group-template").html()),
    childView: PageCoreferentClusterView,
    childViewContainer: '.coreferent-group-container'
});

var PageCoreferentGroupEmptyView = View.extend({
    template: _.template($("#page-coreferent-group-empty-template").html())
});



var PageCoreferenceView = View.extend({
    template: _.template($("#page-coreference-template").html()),
    regions: {
        "tokens": "#page-coreference-tokens",
        "groups": "#page-coreference-groups"
    },
    onRender() {
        let self = this;
        let element = this.regions['tokens'];

        let tokens = self.model.get('tokens');
        _.each(tokens, function (token) {
            token['Status'] = 0;
        });

        self.showChildView('tokens', new PageCoreferentTokensView({
            'el': element,
            'collection': new Backbone.Collection(tokens)
        }).render());

        let groups = [];
        let clusters = self.model.get('clusters');
        for (let clusterID in clusters) {
            if (clusters[clusterID].length > 1) {
                let phrases = [];
                clusters[clusterID].forEach(function (group) {
                    let tokens = [];
                    _.each(group, function (wordID) {
                         tokens.push(self.model.get('tokens')[wordID].RawText)
                    });
                    let phrase = tokens.join(' ');
                    phrases.push(phrase);
                });
                let item = {
                    clusterID: clusterID,
                    phrases: phrases.join(','),
                    state: 0,
                    cluster: clusters[clusterID]
                };
                groups.push(item);
            }
        }

        var view = new PageCoreferentGroupView({
            'el': self.regions['groups'],
            'collection': new Backbone.Collection(groups)
        });
        if (groups.length == 0) {
            view = new PageCoreferentGroupEmptyView({'el': self.regions['groups']});
        }

        self.showChildView('groups', view).render();


    },
    initialize() {

        /**
         * Listen to global events
         * And return necessary information for it
         */
        basicRadioChannel.on(basicRadioChannelEvents.radioEventPageChange, this.onPageChange, this);

    },
    /**
     * Reset collection on the page change event
     */
    onPageChange: function () {
    }
});


var PagePhrasesView = CollectionView.extend({
    template: _.template($("#page-phrases-template").html()),
    childView: PageParsedTokenView,
    childViewContainer: '.page-parsed-wrapper',
    initialize() {

        /**
         * Listen to global events
         * And return necessary information for it
         */
        basicRadioChannel.on(basicRadioChannelEvents.radioEventPageChange, this.onPageChange, this);

    },
    /**
     * Reset collection on the page change event
     */
    onPageChange: function () {
        this.collection.reset();
    }
});


/**
 * View which contains collection of all tokens
 * @type {void|*}
 */
var PageParsedView = CollectionView.extend({
    template: _.template($("#page-parsed-template").html()),
    childView: PageParsedTokenView,
    childViewContainer: '.page-parsed-wrapper',
    initialize() {

        /**
         * Listen to global events
         * And return necessary information for it
         */
        basicRadioChannel.on(basicRadioChannelEvents.radioEventEntitySelect, this.onEntitySelect, this);
        basicRadioChannel.on(basicRadioChannelEvents.radioEventPageChange, this.onPageChange, this);
        basicRadioChannel.reply(basicRadioChannelEvents.radioEventEntityGetSelected, this.getSelectedEntities, this);
        basicRadioChannel.reply(basicRadioChannelEvents.radioEventEntityRetrieve, this.getAllEntities, this);

        /**
         * Listen to the change of the internal collection
         */
        this.listenTo(this.collection, 'add', this.render);
        this.listenTo(this.collection, 'remove', this.render);
        this.listenTo(this.collection, 'update', this.render);
        this.listenTo(this.collection, 'reset', this.render);
    },
    /**
     * Select/deselect entity
     * @param number
     */
    onEntitySelect: function (number) {
        let entity = this.collection.at(number);
        entity.set('isSelected', !entity.get('isSelected'));
    },
    /**
     * Return array with selected tokens
     */
    getSelectedEntities: function () {
        return this.collection.filter(token => token.get('isSelected'));
    },
    /**
     * Return the whole collection of tokens
     * which are represented as array of objects (attributes)
     */
    getAllEntities: function () {
        return this.collection.toJSON();
    },
    /**
     * Reset collection on the page change event
     */
    onPageChange: function () {
        this.collection.reset();
    },
    onBeforeDestroy() {
        basicRadioChannel.off(basicRadioChannelEvents.radioEventEntitySelect, this.onEntitySelect, this);
    }
});

/**
 * View for displaying of the input text
 * @type {void|*}
 */
var PageTextboxView = View.extend({
    template: _.template($("#page-textbox-template").html()),
    initialize() {
        /**
         * Global events for the loading of the file text and retrieving of the text
         */
        basicRadioChannel.on(basicRadioChannelEvents.radioEventFileSelected, this.onFileSelectedEvent, this);
        basicRadioChannel.reply(basicRadioChannelEvents.radioEventFileGetText, this.getText, this);
    },
    /**
     * Set file text
     * @param text
     */
    onFileSelectedEvent: function (text) {
        this.model.set('fileText', text);
        this.render();
    },
    /**
     * Retrieve input text
     * @returns {*}
     */
    getText: function () {
        let text = this.$el.find("#file-text").val();
        this.model.set('fileText', text);
        return text;
    },
    onBeforeDestroy() {
        basicRadioChannel.off(basicRadioChannelEvents.radioEventFileSelected, this.onFileSelectedEvent, this);
    }
});

/**
 * Page content view
 * @type {void|*}
 */
var PageView = View.extend({
    template: _.template($("#page-template").html()),

    /**
     * Current page alias
     */
    activePage: 'textbox',

    /**
     * Data for current page
     */
    activeData: [],
    regions: {
        "content": "#page-content"
    },
    initialize: function () {
        basicRadioChannel.on(basicRadioChannelEvents.radioEventPageChange, this.onPageChange, this);
    },
    /**
     * Re-render page content with the given data
     * @param page
     * @param parsedData
     */
    onPageChange: function (page, parsedData) {
        this.activePage = page;
        this.activeData = parsedData;
        this.render();
    },
    onRender() {
        let self = this;
        let element = this.regions['content'];
        switch (this.activePage) {
            case "textbox":
                self.showChildView('content', new PageTextboxView({
                    'el': element,
                    'model': new PageTextboxModel()
                }).render());
                break;
            case "parsed":
                self.showChildView('content', new PageParsedView({
                    'el': element,
                    'collection': new Backbone.Collection(self.activeData)
                }).render());
                break;
            case "ExtractPhrases":
                self.showChildView('content', new PagePhrasesView({
                    'el': element,
                    'collection': new Backbone.Collection(self.activeData.tokens)
                }).render());
                break;
            case "EstimateCoherence":
                self.showChildView('content', new PageCoherenceView({
                    'el': element,
                    'model': new Backbone.Model(self.activeData)
                }).render());
                break;
            case "ExtractCoreferent":
                self.showChildView('content', new PageCoreferenceView({
                    'el': element,
                    'model': new Backbone.Model(self.activeData)
                }).render());
                break;
            default:
                break;
        }
    },
    onBeforeDestroy() {
        basicRadioChannel.off(basicRadioChannelEvents.radioEventPageChange, this.onPageChange, this);
    }
});

/**
 * Global layout of the application
 */
var AppLayout = View.extend({
    template: _.template($("#app-layout-template").html()),
    regions: {
        "header": "#header",
        "sidebar": "#sidebar",
        "page": "#page"
    },
    events: {},
    initialize: function () {
        /**
         * Listen to events for showing/hiding of the preloader
         */
        basicRadioChannel.on(basicRadioChannelEvents.radioEventPreloaderShow, this.onPreloaderShow, this);
        basicRadioChannel.on(basicRadioChannelEvents.radioEventPreloaderHide, this.onPreloaderHide, this);
    },
    /**
     * Get UI element of preloader
     */
    getPreloaderUIElement: function () {
        return this.$el.find("#preloader");
    },
    /**
     * Show preloader
     */
    onPreloaderShow: function () {
        this.getPreloaderUIElement().addClass('visible');
    },
    /**
     * Hide preloader
     */
    onPreloaderHide: function () {
        this.getPreloaderUIElement().removeClass('visible');
    },
    /**
     * Build layout
     */
    onRender() {
        this.showChildView('header', new HeaderView({
            'el': this.regions['header'],
            'model': new NLPModel()
        }).render());
        this.showChildView('page', new PageView({
            'el': this.regions['page'],
            model: new Model({activePage: 'default'}),
            activePage: "default"
        }).render());
    },
    onBeforeDestroy() {
        basicRadioChannel.off(basicRadioChannelEvents.radioEventPreloaderShow, this.onPreloaderShow, this);
        basicRadioChannel.off(basicRadioChannelEvents.radioEventPreloaderHide, this.onPreloaderHide, this);
    }
});

