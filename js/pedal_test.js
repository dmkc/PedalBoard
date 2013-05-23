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
require(['master', 'slave', 'syncmodel', 'peerui', 'jquery-1.9.1.min','controllers', 'views'], 
        function(Master, Slave, Backbone, PeerUI, jQuery, Controllers, Views) {
    var peer;

    window.Backbone = Backbone;
    window.View = new Views.PedalBoardView().init();
})
