requirejs.config({
    shim: {
      "backbone": {
          deps: ["underscore"],
          exports: "Backbone"
      },
      "underscore": {
          exports: "_"
      }
    }
});


require(['master', 'slave', 'peerbb', 'peerui'], function(Master, Slave, PeerUI) {
    var peer;
    console.log(Master, Slave);       


    document.querySelector('#sendButton').addEventListener('click', function(){
        peer.sendToAll(document.getElementById('dataChannelSend').value)
    });


});

