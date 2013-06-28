// Configure non-require friendly modules
requirejs.config({
    shim: {
      "backbone": {
          deps: ["underscore", 'jquery-2.0.2.min'],
          exports: "Backbone"
      },
      "underscore": {
          exports: "_"
      },
      "jquery-2.0.2.min": {
          exports: "jQuery"
      },
      "mobile-range-slider": {
          exports: "MobileRangeSlider"
      },
    }
});


require(['rtc/peer', 'rtc/syncmodel', 'peerui', 'jquery-2.0.2.min','views'], 
        function(Peer, Backbone, PeerUI, jQuery, Views) {
    var peer,
        app = new Views.AppView().init()
});

