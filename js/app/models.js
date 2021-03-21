const { Model } = Backbone;
const { Behavior } = Marionette;

/**
 * Global channel for the message exchange
 */
const basicRadioChannel = Backbone.Radio.channel('basic');

/**
 * All events for the global channel
 */
const basicRadioChannelEvents = {
    radioEventFileSelected: 'file:selected',
    radioEventFileGetText: 'file:getText',
    radioEventPreloaderShow: 'preloader:show',
    radioEventPreloaderHide: 'preloader:hide',
    radioEventPageChange: 'page:change',
    radioEventEntitySelect: 'entity:select',
    radioEventEntityGetSelected: 'entity:getSelected',
    radioEventEntityAddToCluster: 'entity:addToCluster',
    radioEventEntityRemoveFromCluster: 'entity:removeFromCluster',
    radioEventEntityRetrieve: 'entity:retrieve',
    radioEventClusterSizeChange: 'cluster:sizeChange',
    radioEventNotification: 'notification:push',
    radioEventClusterSelectDeselect: 'cluster:selectDeselect'
};

/**
 * Server IP
 * @type {string}
 */
const hostIP = "https://7ede442c6916.ngrok.io";

/**
 * API endpoints
 * @type {string}
 */
const urlExtract = '/extract';
const urlSave = '/save';

/**
 * Error messages
 */
const errorMessages = {
    "serverError": "Server error",
    "emptyEntities": "No entity was found in the text"
};

/**
 * Model for the processing of the input textbox data
 * @type {void|*}
 */
var PageTextboxModel = Model.extend({
    defaults: {
        fileText: ""
    }
});

var PageParsedModel = Model.extend({});

/**
 * Model for sending of the requests to API endpoints
 * @type {void|*}
 */
var ApiModel = Model.extend({

    /**
     * Send JSON request to server
     * @param uri
     * @param options
     * @returns {*}
     */
    sendJSONRequest: function (uri, options) {
        let ajaxOptions = _.extend({
            cache: false,
            dataType: 'json',
            url: hostIP + uri,
            contentType: 'application/json',
            type: 'post',
            success: function (response) {
                if (_.isNull(response) || _.isUndefined(response)) {
                    return deferred.reject();
                }
                return deferred.resolve(response);
            },
            error: function () {
                return deferred.reject();
            }
        }, options);
        var deferred = $.Deferred();
        $.ajax(ajaxOptions);
        return deferred.promise();
    }
});


/**
 * NLP model for communicating with NLP-based API endpoints and response parsing
 */
var NLPModel = ApiModel.extend({

    defaults: {
        clusters: [],
        urlExtractPhrases: '/api/get_phrases',
        urlEstimateCoherence: '/api/get_coherence',
        urlExtractCoreferent: '/api/get_coreferent_clusters'
    },

    /**
     * Save all tokens
     * @param tokens
     * @returns {*}
     */
    saveTokens: function (tokens) {
        let deferred = $.Deferred();
        let options = {
            data: JSON.stringify(tokens),
            type: "post"
        };
        this.sendJSONRequest(urlSave, options).done(function () {
            return deferred.resolve();
        }).fail(function () {
            return deferred.reject(errorMessages.serverError);
        });
        return deferred.promise();
    },

    /**
     * Bind server response to JS presentation
     * @param token
     * @param entityNumber
     */
    createItemFromToken: function (token, entityNumber) {
        return {
            isSelected: false,
            word: token.word,
            tag: token.tag,
            isEntity: token.isEntity,
            groupID: null,
            groupWords: [],
            entityNumber: entityNumber,
            clusterID: null,
            lemma: token.lemma,
            pos: token.pos,
            isProperName: token.isProperName,
            isHeadWord: token.isHeadWord
        };
    },

    /**
     * Extract all tokens, tags and named entities from the text
     * @param text
     * @returns {*}
     */
    extractEntitiesFromText: function (text) {
        let self = this;
        let deferred = $.Deferred();
        let options = {
            data: JSON.stringify({"text": text}),
            type: "post"
        };

        /**
         * Send request to the API endpoint
         */
        this.sendJSONRequest(urlExtract, options).done(function (response) {
            if (_.isEmpty(response.entities) && _.isEmpty(response.named_entities)) {
                return deferred.reject(errorMessages.emptyEntities);
            }
            /**
             * Save full response to local storage as global object
             */
            localStorage.setItem('parsedText', JSON.stringify(response));

            /**
             * Parse response and prepare data for collection view
             */
            let items = [];
            let counter = 0;
            let entityNumber = 0;

            /**
             * Loop through all tokens
             */
            while (counter < response.tokens.length) {
                let token = response.tokens[counter];
                let dataItem = self.createItemFromToken(token, entityNumber);
                /**
                 * If token is a part of entity group
                 * Than merge all words of group and set it as entity; pass all corresponding words
                 * Else check if the word is entity
                 */
                if (!_.isNull(token.groupID)) {
                    dataItem.isEntity = true;
                    dataItem.word = token.groupWord;
                    dataItem.groupID = token.groupID;
                    let i = counter;
                    for (i = counter; i < counter + token.groupLength; i++) {
                        dataItem.groupWords.push(self.createItemFromToken(response.tokens[i], 0))
                    }
                    counter += token.groupLength;
                }
                else {
                    counter++;
                }
                items.push(dataItem);
                entityNumber++;
            }
            return deferred.resolve(items);
        }).fail(function () {
            return deferred.reject(errorMessages.serverError);
        });
        return deferred.promise();
    }

});


/**
 * Notification model
 * It is used to propagate the message to the notification block
 */
var NotificationModel = Model.extend({
    initialize: function (options) {
        /**
         * Check if the message is passed in the arguments
         * In other case reset the notification block
         */
        if (!_.isUndefined(options) && _.isObject(options)) {
            this.setMessage(options.message);
        }
        else {
            this.setMessage();
        }
        basicRadioChannel.on(basicRadioChannelEvents.radioEventNotification, this.setMessage, this);
    },
    /**
     * Set the notification block with the appropriate message and status
     * @param message
     * @param status
     */
    setMessage: function (message, status) {
        if (!_.isUndefined(message)) {
            let n = new Noty({
                type: status,
                text: message,
                layout: 'bottomCenter',
                timeout: false,
                theme: 'metroui'
            });
            n.show();
        }
        else {
            Noty.closeAll();
        }
    },
    /**
     * Default message for the notification block
     * @returns {*}
     */
    getDefaultMessage: function () {
        return "Default message";
    }
});