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
    var peer;

    window.Backbone = Backbone;
    window.Models = Models
    startTest()

    function startTest() {
        Backbone.SyncRouter.on('init', function() {
            console.log("Sync router initialized")
            window.PedalBoardView = new Views.PedalBoardView().init()
        })

        Backbone.SyncRouter.init()
    }
});

