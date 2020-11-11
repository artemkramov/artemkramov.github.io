const { Application } = Marionette;

/**
 * Global model for making of notifications
 * @type {NotificationModel}
 */
const notificationModel = new NotificationModel();

/**
 * Application object
 */
const App = Application.extend({
    region: "body",
    onStart() {
    /**
     * Prepare layout to form the page
     * @type {AppLayout}
     */
    var appLayout = new AppLayout({ el: 'body' });
    var self = this;

    /**
     * Render the layout
     */
    self.showView(appLayout.render());
}
});

/**
 * Start application
 */
const app = new App();
app.start();