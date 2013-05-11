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

    /*
    document.querySelector('#makeMaster').addEventListener('click', function(){
        peer = new Master();
    });
    */
    document.querySelector('#makeSlave').addEventListener('click', function(){
        peer = new Slave();
        window.peer = peer;
    });

    document.querySelector('#sendButton').addEventListener('click', function(){
        peer.sendToAll(document.getElementById('dataChannelSend').value)
    });


});

