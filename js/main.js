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


require(['rtc/peer', 'rtc/syncmodel', 'peerui', 'jquery-1.9.1.min','views'], 
        function(Peer, Backbone, PeerUI, jQuery, Views) {
    var peer,
        session_id = undefined,
        app = new Views.AppView().init(session_id)


});

