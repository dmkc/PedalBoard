require(['master', 'slave'], function(Master, Slave) {
    var peer;
    console.log(Master, Slave);       

    document.querySelector('#makeMaster').addEventListener('click', function(){
        peer = new Master();
    });
    document.querySelector('#makeSlave').addEventListener('click', function(){
        peer = new Slave();
    });

    document.querySelector('#sendButton').addEventListener('click', function(){
        peer.sendToAll(document.getElementById('dataChannelSend').value)
    });

});
