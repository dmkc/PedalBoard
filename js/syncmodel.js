// SyncModel is a subclass of Backbone.Model that allows 
define(['backbone', 'util'], function(Backbone, util) {
    var peers = {},
        subscriptions = {},


    // Data structure for keeping track of model instances and their
    // subscriptions. Subs because I can't spell "subscription" 
    ModelPool = {
        // TODO: clean up destroyed models and dead clients
        add: function(model) {
            var subscr,
                curModel;

            if (subscriptions[model.name] === undefined) {
                subscriptions[model.name] = {};
            }
            curModel = subscriptions[model.name];

            if (curModel[model.id] === undefined) {
                curModel[model.id] = model
            }
        },

        getAll: function(name) {
            if (subscriptions[name] === undefined)
                return null;
            else
                return subscriptions[name];
        },

        get: function(name, model_id) {
            var subscribers = this.getAll(name);

            return (subscribers != null) ?
                subscribers[model_id] :
                null;
        },
    },


    SyncRouter = {
        // Map model names to class names for re-instantiation on other clients
        modelMap: {},

        init: function(peer) {
            if(!peer) throw "SyncRouter needs to be initiated with a Peer node"
            this.peer = peer;
            this.peer.on('datachannel', 
                         util.proxy(this.dataChannelCallback, this)
                        );
            this.peer.on('connection_state', util.proxy(this.dataChannelState, this));
        },

        makeMsg: function(model, type) {
            var type = type || 'sync_update';

            return {
                type: type,
                body: {
                    name: model.name,
                    id:   model.id,
                    data: (type != 'sync_full') ? model.changedAttributes() 
                                 : _.clone(model.attributes)
                }
            };
        },

        dataChannelCallback: function(e) {
            var msg = e.dataParsed,
                subscr,
                model;

            if (msg.type == 'sync_update' || 
                msg.type == 'sync_full') 
            {
                model = ModelPool.get(msg.body.name, msg.body.id);

                // Model already in the pool
                if(model != null) {
                    model.set(msg.body.data, {
                        noBroadcast: true
                    });

                    this.peer.sendToAll(
                        this.makeMsg(model), 
                        e.client_id);

                // Model not yet present in the pool
                } else {
                    if(this.modelMap[msg.body.name] === undefined) {
                        throw "Unknown model: " + msg.body.name;
                    }
                    model = new this.modelMap[msg.body.name](msg.body.data);
                    model.id = msg.body.id;

                    // Request the rest of the model if this wasn't a full dump
                    if(msg.type != 'sync_full') {
                        this.peer.sendTo(
                            e.client_id,
                            this.makeMsg(model, 'sync_request')
                        );
                    }

                    this.trigger('model_new', {
                        model: model
                    });
                }

            // Another peer requesting full data dump of model
            } else if (msg.type == 'sync_request') {
                model = ModelPool.get(msg.body.name, msg.body.id);

                // Model already in the pool
                if(model == null) {
                    console.error('BB: Request to sync a missing model', msg);
                    return;
                }

                this.peer.sendTo(
                    e.client_id, 
                    this.makeMsg(model, 'sync_full')
                );
            }
        },

        dataChannelState: function(e) {
            // pass through connection state changes
            this.trigger('connection_state', e);
        },
        
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
        try {
            SyncRouter.peer.sendToAll(
                SyncRouter.makeMsg(target)
            );
        } catch(e) {
            console.error("Failed to send changes", e);
        }
    };

    // A synchronizable model
    Backbone.SyncModel = Backbone.Model.extend({
        constructor: function() {
            Backbone.Model.apply(this, arguments);
            this.on('all', changeCallback);

            if(arguments[0] !== undefined &&
               arguments[0].id !== undefined)
                this.id = arguments[0].id;
            else
                this.id = this.cid;

            ModelPool.add(this);
        }

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
    Backbone.ModelPool = ModelPool;

    return Backbone;
});
