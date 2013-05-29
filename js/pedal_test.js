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
    window.View = new Views.PedalBoardView().init();
})
