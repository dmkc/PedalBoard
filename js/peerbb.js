define(['master', 'slave', 'backbone', 'util'], function(Master, Slave, Backbone, util) {
    var peers = {},
        subscriptions = {};


    // Data structure for keeping track of model instances and their
    // subscriptions. Subs because I can't spell "subscription" 
    PeerSubs = {
        // TODO: clean up destroyed models and dead clients
        add: function(model, client_id, acknowledged) {
            var subscr,
                curModel;

            // Whether acknowledgement to sync this model has been received
            // from the other end.
            if(acknowledged === undefined){ 
                var acknowledged = false;
            }

            if (subscriptions[model.name] === undefined) {
                subscriptions[model.name] = {};
            }
            curModel = subscriptions[model.name];

            if (curModel[model.id] === undefined) {
                curModel[model.id] = {};
            }

            // This is what a Subscriber type looks like
            subscr = curModel[model.id][client_id] = {
                client_id: client_id,
                model: model,
                ack: acknowledged
            };

            return subscr;
        },

        getSubscribers: function(model) {
            if (subscriptions[model.name] === undefined)
                return null;

            if (subscriptions[model.name][model.id] === undefined)
                return null;
            else
                return subscriptions[model.name][model.id];
        },

        getSubscription: function(model, client_id) {
            var subscribers = this.getSubscribers(model);

            return (subscribers[client_id] !== undefined) ?
                subscribers[client_id] :
                null;
        },
    }

    // * Pass {synced: true} option when setting local model from remote
    // TODO Next: split up router into ModelRouter and UIRouter. 'sync_init'
    // is just one type of data exchange, model exchange, but other cross-browser
    // messaging can happen too. Cross-browser event mixin?
    PeerRouter = {
        // TODO: add events for when initialization has taken place
        // TODO: add destruction of connections
        // Map model names to class names for re-instantiation on other clients
        modelMap: {},

        // TODO: shoot even for when the router is ready
        init: function(opts) {
            this.peerOpts = _.extend({}, opts);
            this.peerOpts.master = this.peerOpts.master || false;

            this.peer =  (this.peerOpts.master) ? new Master() : new Slave();
            this.peer.ondatachannel = util.proxy(this.dataChannelCallback, this);
        },

        // Notify all subscribed peers
        broadcast: function(obj) {
            // TODO: handle cases of being disconnected
            //
            // this.isAlive()
            // Obj can be a collection or a single model
            var modelList = (obj['models'] === undefined) ? [obj]
                                : obj.models,
                result = [];

            for(var m in modelList) {
                var model = modelList[m],
                    subscribers = PeerSubs.getSubscribers(model);

                for(var p in subscribers) {
                    if (subscribers[p] !== undefined) {
                        this.send(subscribers[p]);
                    }
                }
            }
        },

        subscribeModel: function(model, client_id, acknowledged) {
            // TODO: clean up disconnected peers
            PeerSubs.add(model, client_id, acknowledged);
        },

        // Send a model to Subscriber `sendto`
        send: function(dest) {
            var model = dest.model,
                message;

            console.log('Sending to peer', dest);

            if(!dest.ack) {
                message =  {
                    type: 'sync_init',
                    name: dest.model.name,
                    id:   dest.model.id,
                    data: _.clone(dest.model.attributes) 
                };

            } else {
                message =  {
                    type: 'sync_update',
                    name: dest.model.name,
                    id:   dest.model.id,
                    data: dest.model.changedAttributes()
                };

            }

            this.peer.sendTo(dest.client_id, message);

        },

        dataChannelCallback: function(e) {
            var msg,
                subscr,
                model;

            console.log('Router received data:', e);

            if(!e.data) return;

            try {
                msg = JSON.parse(e.data);
            } catch(e) {
                console.error("DATA CHANNEL ERR: Failed to parse JSON:", e);
                return;
            }

            if(msg.type == 'sync_init') {
                // Init a new model
                if(PeerSubs.getSubscribers(msg) != null) {
                    console.error('Model already in sync:', msg);
                    return;
                }
                model = new this.modelMap[msg.name](msg.data);
                model.id = msg.id;
                this.subscribeModel(model, e.client_id, true);

                this.trigger('model_new', {
                    model: model
                });

                // Acknowledge that we've set up the sync
                this.peer.sendTo(e.client_id, {
                    type: 'sync_ack',
                    name: msg.name,
                    id: msg.id
                });


            } else if (msg.type == 'sync_ack') {
                // look for connection and set its acknowledged state to false
                subscr = PeerSubs.getSubscription(msg, e.client_id)
                
                if (subscr != null) {
                    console.log('Sync acknowledged from', e.client_id, msg);
                    subscr.ack = true;
                }
            }
        },

        /*
        flatten: function(obj, client_id) {
            if(obj instanceof Backbone.PeerModel) {
                return this.flattenModel(obj);
            } else if (obj instanceof Backbone.PeerCollection) {
                return this.flattenCollection(obj, client_id);
            }
        },
        flattenCollection: function(col, client_id) {
            var models = [], modelOpts;

            for(var m in col.models) {
                modelOpts = this.getModel(col.models[m], client_id);
                if (modelOpts == null) continue;

                models.push(this.flattenModel(modelOpts.model, 
                                              modelOpts.ack));         
            }

            return {
                type: 'collection',
                name: col.name,
                models: models
            }
        }
        */

        
    }

    
    function changeCallback(eventName, target, opts) {
        var uninteresting = ['request', 'sync', 'invalid', 'route'];

        // Broadcast all interesting non-sync originating events
        if (eventName in uninteresting ||
            eventName.indexOf(':') >= 0 || 
            opts.synced === true) {
            return;
        }
        console.log('Significant model event', eventName);
        PeerRouter.broadcast(target);
    }

    // A synchronizable model
    Backbone.PeerModel = Backbone.Model.extend({
        constructor: function() {
            Backbone.Model.apply(this, arguments);
            this.on('all', changeCallback);
            this.id = this.cid;
            //PeerSubs.addInstance(this);
        },

        subscribe: function(client_id) {
            PeerRouter.subscribeModel(this, client_id);
        },

    });

    // Override extending to keep track of name to model mapping, which we'll
    // need to instantiate models on other peers
    Backbone.PeerModel.extend = function(obj) {
        if (!obj.name) throw "A PeerModel must have a name";
        var result = Backbone.Model.extend.apply(this, arguments);
        PeerRouter.modelMap[obj.name] = result;
        result.name = obj.name;
        return result;
    }

    // COLLECTIONS
    Backbone.PeerCollection = Backbone.Collection.extend({
        constructor: function() {
            if (!this.name) throw "A PeerCollection must have a name";
            else console.log('Instance of', this.name);

            this.on('all', changeCallback);
            Backbone.Collection.apply(this, arguments);
        },

    });

    _.extend(PeerRouter, Backbone.Events);


    TestModel = Backbone.PeerModel.extend({
        name: 'TestModel'
    });

    TestCollection = Backbone.PeerCollection.extend({
        name: 'TestCollection'
    });

    Backbone.PeerRouter = PeerRouter;
    Backbone.PeerSubs = PeerSubs;
    Backbone.TestModel = TestModel;
    window.Backbone = Backbone;

    window.startTest = function(master) {
        PeerRouter.init({master: master})
        PeerRouter.on('model_new', function(data) {
            console.log('New PeerModel has been init', data);
            window.model = data.model;
        });
        var model = new TestModel();

        if(master) {
            setTimeout( function(){
                model.subscribe(PeerRouter.peer.connections[0].client_id);
                model.set('blah', 123);
                model.set('blah', 1833);
            }, 1000);
        }

        window.model = model;
        window.coll = TestCollection;
    }

    return Backbone;
});
