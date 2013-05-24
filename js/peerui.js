define(['backbone', 'util'], function(Backbone, util) {
    // Basically Backbone events wrapped around data channels managed 
    // by a `Peer`
    // SyncRouter should probably use event router
    PeerUI = {
        init: function(peer) {
            if(!peer) throw "EventRouter needs to be initiated with a Peer node"
            this.peer = peer;
            this.peer.on('datachannel', util.proxy(this.handleMessage, this));

            console.log("PEERUI: Init with peer", peer);
        },

        send: function(type, body) {
            this.peer.sendToAll({
                    type: type,
                    body: body
            });
        },

        handleMessage: function(e) {
            var msg = e.dataParsed;

            if(msg.type == 'peerui') {

            }
        }
    }

    return PeerUI;
    /*
    dui.pushScreen(
        client_id, // ID of client to push this to. This can be a different
                   // browser tab, browser, or device
        'name',    //filename screen is stored in
        [
            {
                name: 'modelName',
                a: 123,
                b: 321
            },
            {
                name: 'anotherModel',
                c: 321,
                d: 123
            }
        ]);
    
    function pushScreen(client_id, name, models){
        var screen = new Screen(name).init().
        screen.addModel(models); 
    }

    function Screen(name) {
        // too long
        dom.append(loadScreenFromDisk(name));

        function loadScreenFromDisk(name) {
            // retrieve html from file
            // OR, existing DOM node. How does backbone do this?
            return html;
        }
    }

    Screen.prototype.addModel = function addModel(name, models) {
        var models = (name instanceof Array) ? name : [{name: models}];
        // Keep track of used models. Syncronize models  before pushing 
        // screens to other devices

    }

    */
});
