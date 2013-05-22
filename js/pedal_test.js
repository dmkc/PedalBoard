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
require(['master', 'slave', 'syncmodel', 'peerui', 'jquery-1.9.1.min','board', 'pedals'], 
        function(Master, Slave, Backbone, PeerUI, jQuery, PedalBoard, Pedals) {
    var peer;

    window.Backbone = Backbone;
    window.Pedals = Pedals;
    window.PedalBoard = PedalBoard.init();

    PedalBoard.addPedal('Compressor');
})
