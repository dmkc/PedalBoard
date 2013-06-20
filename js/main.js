// Configure non-require friendly modules
requirejs.config({
    shim: {
      "backbone": {
          deps: ["underscore", 'jquery-1.9.1.min'],
          exports: "Backbone"
      },
      "underscore": {
          exports: "_"
      },
      "jquery-1.9.1.min": {
          exports: "jQuery"
      }
    }
});


require(['rtc/peer', 'rtc/syncmodel', 'peerui', 'jquery-1.9.1.min','views', 'models'], 
        function(Peer, Backbone, PeerUI, jQuery, Views, Models) {
    var peer,
        session_id = undefined,

        Router = Backbone.Router.extend({
            routes: {
                "new": "newSession",
                "s/:sid": "joinSession", 
            },

            newSession: function(){
                this.initApp()
            },

            joinSession: function(sid) {
                this.initApp(sid)
            },

            initApp: function(session_id){
                Backbone.SyncRouter.on('init', _.bind(function() {
                    console.log("Sync router initialized")
                    window.PedalBoardView = new Views.PedalBoardView().init()
                    history.pushState(
                        { session_id: this.peer.session_id }, 
                        "In session", 
                        "/s/"+this.peer.session_id)
                }, Backbone.SyncRouter))

                Backbone.SyncRouter.init(session_id)
            },
        }),

        router = new Router()

    Backbone.history.start({pushState: true})

    window.Backbone = Backbone;
    window.Models = Models
});

