// SyncModel is a subclass of Backbone.Model that allows 
define(['backbone', 'util'], function(Backbone, util) {
    var peers = {},
        subscriptions = {},


    // Data structure for keeping track of model instances and their
    // subscriptions. 
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

            this.trigger('add', model);
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
        rootModel: null,

        init: function(peer) {
            if(!peer) throw "SyncRouter needs to be initiated with a Peer node"

            // RootModel is where we store references to all collectons
            this.rootModel = new RootModel({id: '_root'})
            this.rootModel.set('_collections', [], {noBroadcast: true}) 

            this.peer = peer;
            this.peer.on('data_channel_message', 
                         util.proxy(this.dataChannelCallback, this)
                        );
            this.peer.on('data_channel_state', util.proxy(this.dataChannelState, this));
            this.trigger('init', this)
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

        // Main model sync handler
        dataChannelCallback: function(e, connection) {
            var msg = e.dataParsed,
                subscr,
                model;

            if (msg.type == 'sync_update' || 
                msg.type == 'sync_full') 
            {
                model = ModelPool.get(msg.body.name, msg.body.id);

                // Model already in the pool
                if(model != null) {
                    // Only master can broadcast its collection list
                    if(msg.type == 'sync_full' && msg.body.id == '_root' && 
                       this.peer.master)
                        return

                    model.set(msg.body.data, {
                        noBroadcast: true
                    });

                    model.trigger('sync', model)

                // Model not yet present in the pool
                } else {
                    if(this.modelMap[msg.body.name] === undefined) {
                        throw "Unknown model: " + msg.body.name;
                    }
                    _.extend(msg.body.data, {id:msg.body.id})

                    model = new this.modelMap[msg.body.name](msg.body.data);

                    // Request the rest of the model if this wasn't a full dump
                    if(msg.type != 'sync_full') {
                        this.peer.sendTo(
                            connection,
                            this.makeMsg(model, 'sync_request')
                        );
                    }

                    this.trigger('model_sync', {
                        model: model
                    });
                }

            // Another peer requesting full data dump of model
            } else if (msg.type == 'sync_request') {
                model = ModelPool.get(msg.body.name, msg.body.id);

                // Model already in the pool
                if(model == null) {
                    // TODO: add response type for failed model requests
                    console.error('BB: Request to sync a missing model', msg);
                    return
                }

                this.peer.sendTo(
                    connection,
                    this.makeMsg(model, 'sync_full')
                );
            }
        },

        dataChannelState: function(e) {
            // If this is a master node, send own root model to all the 
            // connected slaves.
            if (e.state == 'open' && this.peer.master) {
                this.peer.sendToAll(
                    SyncRouter.makeMsg(SyncRouter.rootModel, 'sync_full')
                )
            }
        },
        
    },
    
    changeCallback = function changeCallback(eventName, target, opts) {
        var uninteresting = ['request', 'sync', 'invalid', 'route'],
            opts = util.extend({
                    noBroadcast: false
                }, opts);

        // Broadcast all interesting non-sync originating events
        if (uninteresting.indexOf(eventName) > -1 ||
            eventName.indexOf(':') >= 0 || 
            opts.noBroadcast) {
            return;
        }
        console.log('Significant model event', eventName);
        try {
            SyncRouter.peer.sendToAll(
                SyncRouter.makeMsg(target)
            );
        } catch(e) {
            console.error("SyncRouter: not initialized.", e);
        }
    },

    // A synchronizable model
    SyncModel = Backbone.Model.extend({
        sync: function(){
            // Request update to next
            //this._next = null
            SyncRouter.peer.sendToAll(
                SyncRouter.makeMsg(this, 'sync_request')
            )
        },

        constructor: function() {
            // Used for collections
            this._next = this._prev = null;

            Backbone.Model.apply(this, arguments);
            this.on('all', changeCallback);

            if(arguments[0] !== undefined &&
               arguments[0].id !== undefined)
                this.id = arguments[0].id;
            else
                this.id = this.cid;

            ModelPool.add(this);
        },

        // Linked list methods
        _nextNode: function(next){
            var nextNode

            if(next !== undefined) {
                this.set('_next', {
                    name: next.name,
                    id: next.id
                });
                this._next = next;
            } else {
                nextNode = this.get('_next')
                // Update reference to the next model in the collection
                if(nextNode && this._next == null) {
                    this._next = ModelPool.get(nextNode.name, nextNode.id)
                }
                return this._next;
            }
        },

        _prevNode: function(prev){
            var prevNode

            if(prev !== undefined) {
                this.set('_prev', {
                    name: prev.name,
                    id: prev.id
                });
                this._prev = prev;
            } else {
                prevNode = this.get('_prev')
                // Update reference to the previous model in the collection
                if(prevNode && this._prev == null) {
                    this._prev = ModelPool.get(prevNode.name, prevNode.id)
                }
                return this._prev;
            }
        },


    });

    // Override extending to keep track of name to model mapping, which we'll
    // need to instantiate models on other peers
    SyncModel.extend = function(obj) {
        if (!obj.name) throw "A SyncModel must have a name";
        var result = Backbone.Model.extend.apply(this, arguments);
        SyncRouter.modelMap[obj.name] = result;
        result.name = obj.name;
        return result;
    }

    SyncModel.request = function(model_id) {
        var name = this.prototype.name,
            model = ModelPool.get(name, model_id)
        if (!model) {
            model = new SyncRouter.modelMap[name]({id: model_id})
        }
        return model
    }

    // A synchronized linked list
    // TODO: comments
    // TODO: support for 'remove', 'add' events.
    SyncLList = SyncModel.extend({
        name: 'SyncLList',

        constructor: function(obj) {
            SyncModel.apply(this, arguments);

            if(arguments[0] !== undefined &&
               arguments[0].id !== undefined)
                this.id = arguments[0].id;
            else
                this.id = this.cid;

            var cols = SyncRouter.rootModel.get('_collections').splice(0)
            if (cols.indexOf(this.id) < 0) {
                cols.push(this.id)
                SyncRouter.rootModel.set('_collections', cols)
            }
        },

        // Add a model to collection's linked list
        add: function(model) {
            var tail = this.tail || this

            if (model.get('_next') || model.get('_prev')) {
                console.error("SyncLList: This model is already in a collection")
                return
            }

            tail._nextNode(model)
            model._prevNode(this)
            this.tail = model
            this.trigger('add', model)
            return model
        },

        // Remove a model from collection's linked list
        remove: function(model) {
            var cur = this._nextNode(), prev, next
            while(cur !== model) cur = cur._nextNode()
            if (cur === null) return null

            prev = cur._prevNode()
            next = cur._nextNode()
            prev._nextNode(next)
            next._prevNode(prev)

            this.trigger('remove', model)
            return model
        },

        empty: function() {
            return !this.get('_next')
        },

        // Recursively sync this list by syncing every model in the list
        sync: function() {
            var linkedList = this

            this.once('sync', function listSyncHandler() {
                var next = this.get('_next'),
                    nextNode

                // Reached end of linked list
                if (!next) {
                    console.log("SyncLList: sync reached end of list", this)
                    linkedList.trigger('sync', this)
                    return
                }

                nextNode = SyncModel.request(next.name, next.id)
                nextNode.once('sync', listSyncHandler)
                this._next = nextNode
                nextNode.sync()
            })
            SyncModel.prototype.sync.apply(this,arguments)
        },
    });


    // A magic model that keeps track of all collections in the swarm
    var RootModel = SyncModel.extend({
        name: 'RootModel'
    });


    // Mix in bb events
    _.extend(SyncRouter, Backbone.Events);
    _.extend(ModelPool, Backbone.Events);

    Backbone.SyncRouter = SyncRouter;
    Backbone.ModelPool = ModelPool;

    Backbone.SyncModel = SyncModel
    Backbone.SyncLList = SyncLList

    return Backbone;
});
