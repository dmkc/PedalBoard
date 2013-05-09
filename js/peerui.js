define(['master', 'slave', 'backbone'], function(Master, Slave, Backbone) {
    var peers = {},
        models = {};

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

    function DistrModel() {
        // changes in the model are broadcast to all subscribing clients
        // advantages: multiple screens can be tied to same model
        //      need to decouple model from screen
        //
        function subscribe(client_id) {
            // send model name and init values 
        }

        return {

        };
    }
    */

    PeerRouter = {
        // TODO: peer states
        init: function(settings) {
            this.settings = _.extend({}, settings);
            this.settings.master = this.settings.master || false;

            this.peer =  (this.settings.master) ? new Master : new Slave;
        },

        broadcast: function(model) {
            // if model has been set up with peer, send changeset
            // otherwise, send whole model
            var peers = models[model.name];

            for(var p in peers) {
                if (peers[p][model.cid] !== undefined) {
                    this.sendChanges(model, p, model.changedAttributes());
                }
            }
        },

        subscribe: function(model, client_id) {
            // TODO: clean up disconnected peers
            var destPeer,
                curModel;

            if (models[model.name] === undefined) {
                models[model.name] = {};
            }
            curModel = models[model.name];
            if (curModel[client_id] === undefined) {
                curModel[client_id] = {}
            }
            curModel[client_id][model.cid] = model;

            this.initSync(model, client_id);
        },

        initSync: function(model, client_id) {
            this.sendChanges(model, client_id, _.clone(model.attributes));
        },

        sendChanges: function(model, client_id, data) {
            this.peer.sendTo(client_id, JSON.stringify({
                    type: 'model_update',
                    name: model.name,
                    cid:  model.cid,
                    data: data
                })
            );
        }

        
    }

    
    function changeCallback() {
        PeerRouter.broadcast(model);
    }

    // A synchronizable model
    Backbone.PeerModel = Backbone.Model.extend({
        constructor: function() {
            if (!this.name) throw "A PeerModel must have a name";
            else console.log('Instance of', this.name);

            this.on('change', changeCallback);
            Backbone.Model.apply(this, arguments);
        },

        subscribe: function(client_id) {
            PeerRouter.subscribe(this, client_id);
        }
    });

    TestModel = Backbone.PeerModel.extend({
        name: 'TestModel'
    });

    Backbone.PeerRouter = PeerRouter;
    window.Backbone = Backbone;

    window.startTest = function() {
        var model = new TestModel;
        PeerRouter.init({master:true})

        setTimeout( function(){
            model.subscribe(PeerRouter.peer.connections[0].client_id);
        }, 1000);

        window.model = model;
    }

    return Backbone;
});
