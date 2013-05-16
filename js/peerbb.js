// SyncModel is a subclass of Backbone.Model that allows 
define(['backbone', 'util'], function(Backbone, util) {
    var peers = {},
        subscriptions = {},


    // Data structure for keeping track of model instances and their
    // subscriptions. Subs because I can't spell "subscription" 
    ModelSubs = {
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

        // Get all Subscriber's for this model
        getAll: function(model) {
            if (subscriptions[model.name] === undefined)
                return null;

            if (subscriptions[model.name][model.id] === undefined)
                return null;
            else
                return subscriptions[model.name][model.id];
        },

        get: function(model, client_id) {
            var subscribers = this.getAll(model);

            return (subscribers != null &&
                    subscribers[client_id] !== undefined) ?
                subscribers[client_id] :
                null;
        },
    },

    // TODO: split up router into ModelRouter and UIRouter. 'sync_init'
    // is just one type of data exchange, model exchange, but other cross-browser
    // messaging can happen too. Cross-browser event mixin?
    SyncRouter = {
        // TODO: add events for when initialization has taken place
        // TODO: add destruction of connections
        // Map model names to class names for re-instantiation on other clients
        modelMap: {},

        // TODO: shoot even for when the router is ready
        init: function(peer) {
            if(!peer) throw "SyncRouter needs to be initiated with a Peer node"
            this.peer = peer;
            this.peer.ondatachannel = util.proxy(this.dataChannelCallback, this);
            this.peer.on('connection_state', util.proxy(this.dataChannelState, this));
        },

        // Notify all subscribed peers
        broadcast: function(subscriber, except) {
            // TODO: handle cases of being disconnected; this.isAlive()
            var result = [],
                subscribers;

            subscribers = ModelSubs.getAll(subscriber);

            for(var p in subscribers) {
                if (subscribers[p] !== undefined &&
                    (subscribers[p] !== except)) {
                    this.send(subscribers[p]);
                }
            }
        },

        subscribeModel: function(model, client_id, acknowledged) {
            if(ModelSubs.get(model, client_id) != null) {
                console.error('This model is already being synced', model);
            }
            ModelSubs.add(model, client_id, acknowledged);
            this.send(ModelSubs.get(model, client_id));
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

            try {
                this.peer.sendTo(dest.client_id, message);
            } catch(e) {
                console.error('Error sending message to', dest.client_id, message);
            }

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
                // Init a new model and set up a peer subscription for the
                // client that sent the sync init. 
                if(ModelSubs.getAll(msg) != null) {
                    console.error('Model already being synched:', msg);
                    return;
                }
                if(this.modelMap[msg.name] === undefined) {
                    throw "Unknown model: " + msg.name;
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
                subscr = ModelSubs.get(msg, e.client_id)
                
                if (subscr != null) {
                    console.log('Sync acknowledged from', e.client_id, msg);
                    subscr.ack = true;
                }
            } else if (msg.type == 'sync_update') {
                subscr = ModelSubs.get(msg, e.client_id)

                if (subscr == null) {
                    console.error('Attempting to update a model that ' +
                                  'has not been set up yet.', msg);
                    return;
                }
                model = subscr.model;

                model.set(msg.data, {
                    noBroadcast: true
                });

                this.broadcast(model, subscr);
            }
        },

        dataChannelState: function(e) {
            // pass through connection state changes
            this.trigger('connection_state', e);
        },

        /*
        flatten: function(obj, client_id) {
            if(obj instanceof Backbone.SyncModel) {
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

        
    },

    
    changeCallback = function changeCallback(eventName, target, opts) {
        var uninteresting = ['request', 'sync', 'invalid', 'route'];

        // Broadcast all interesting non-sync originating events
        if (eventName in uninteresting ||
            eventName.indexOf(':') >= 0 || 
            opts.noBroadcast === true) {
            return;
        }
        console.log('Significant model event', eventName);
        SyncRouter.broadcast(target);
    };

    // A synchronizable model
    Backbone.SyncModel = Backbone.Model.extend({
        constructor: function() {
            Backbone.Model.apply(this, arguments);
            this.on('all', changeCallback);
            this.id = this.cid;
            //ModelSubs.addInstance(this);
        },

        subscribe: function(client_id) {
            SyncRouter.subscribeModel(this, client_id);
        },

    });

    // Override extending to keep track of name to model mapping, which we'll
    // need to instantiate models on other peers
    Backbone.SyncModel.extend = function(obj) {
        if (!obj.name) throw "A SyncModel must have a name";
        var result = Backbone.Model.extend.apply(this, arguments);
        SyncRouter.modelMap[obj.name] = result;
        result.name = obj.name;
        return result;
    }


    // Mix in bb events
    _.extend(SyncRouter, Backbone.Events);

    Backbone.SyncRouter = SyncRouter;

    return Backbone;
});
