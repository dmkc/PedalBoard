requirejs.config({
    shim: {
      "backbone": {
          deps: ["underscore"],
          exports: "Backbone"
      },
      "underscore": {
          exports: "_"
      },
    }
});


require(['master', 'slave', 'peerbb', 'peerui'], function(Master, Slave, PeerUI) {
    var peer;
    console.log(Master, Slave);       

    window.Backbone = Backbone;

    TestModel = Backbone.SyncModel.extend({
        name: 'TestModel'
    });

    function startTest(master) {
        SyncRouter.init( (master) ? new Master() : new Slave() );
        SyncRouter.on('model_new', function(data) {
            console.log('New SyncModel init request', data);
            window.model = data.model;
        });
        var model = new TestModel();

        if(master) {
            setTimeout( function(){
                model.subscribe(SyncRouter.peer.connections[0].client_id);
                model.set('blah', 123);
                model.set('blah', 1833);
            }, 1000);
        }

        window.model = model;
    }

    document.querySelector('#makeSlave').addEventListener('click', function(){
        startTest(false);
    });
    document.querySelector('#makeMaster').addEventListener('click', function(){
        startTest(true);
    });
    document.querySelector('#sendButton').addEventListener('click', function(){
        peer.sendToAll(document.getElementById('dataChannelSend').value)
    });


});

