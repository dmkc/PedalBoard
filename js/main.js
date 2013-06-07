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


require(['rtc/master', 'rtc/slave', 'rtc/syncmodel', 'peerui', 'jquery-1.9.1.min','views'], 
        function(Master, Slave, Backbone, PeerUI, jQuery, Views) {
    var peer;

    window.Backbone = Backbone;

    if(window.location.hash == '#slave') {
        startTest(false);
    } else if (window.location.hash == '#master') {
        startTest(true);
    }

    function startTest(master) {
        peer =  (master) ? new Master() : new Slave();
        PeerUI.init(peer);

        Backbone.SyncRouter.on('init', function() {
            console.log("Sync router initialized")
            window.PedalBoardView = new Views.PedalBoardView().init();

            if(master) {
                new Backbone.SyncLList({id:'_slotViews'})
                new Backbone.SyncLList({id:'_models'})
            }
        })

        Backbone.SyncRouter.init(peer)
    }
});

