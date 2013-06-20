// SyncModel is a subclass of Backbone.Model that allows 
define(['backbone', 'util', 'rtc/peer'], function(Backbone, util, Peer) {
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
        // State machine for connection initialization
        states: {
            START: 0,
            REGISTERED: 1,
            INITIALIZING: 2,
            INITIALIZED: 3,
        },
        state: 0,

        init: function() {
            var that = this

            this.peer = new Peer()

            // If true, then the root model is in sync with swarm. 
            // RootModel is where we store references to all collectons
            this.rootModel = RootModel.request('_root')
            this.rootModel.set('_collections', [], {silent: true}) 

            this.peer.on('data_channel_message', 
                         util.proxy(this.dataChannelCallback, this)
                        );
            this.peer.on('data_channel_state', util.proxy(this.dataChannelState, this));

            // Once registered, set up root model syncing
            this.peer.once('registered', _.bind(function(msg){
                console.log('SyncRouter: registered', msg)
                this.state = this.states.REGISTERED

                // SyncRouter is initialized once the root model is in sync
                this.rootModel.once('sync', function(){
                    console.log('SyncRouter: root model synchronized', 
                                that.rootModel)
                    that.state = that.states.INITIALIZED
                    that.trigger('init')
                })

                // If we're the only client in the session, then initialization
                // was successful, and we don't need to sync the root model. 
                // Otherwise, rootModel will sync itself upon the first
                // established peer connection
                if(msg.client_count == 1) {
                    this.rootModel.trigger('sync')
                }
            }, this))

            // Remove all connections before quitting
            window.addEventListener('beforeunload', function(){
                that.peer.shutdown()
            })

            this.peer.init()
        },

        makeMsg: function(model, full) {
            if (model) {
                return {
                    name: model.name,
                    id:   model.id,
                    data: (!full) ? model.changedAttributes() || {}
                                 : _.clone(model.attributes)
                }
            } else {
                return null
            }
        },

        // Main model sync handler
        dataChannelCallback: function(e, connection) {
            var msg = e.dataParsed,
                subscr,
                model = ModelPool.get(msg.body.name, msg.body.id)

            console.log("SyncRouter: New message", msg)

            if (msg.type == 'change' || 
                msg.type == 'change_full') 
            {
                // Model already in the pool
                if(model != null) {
                    model.set(msg.body.data, {
                        broadcast: false
                    });

                    // Received a full data dump. Notify model subscribers.
                    if(msg.type == 'change_full') {
                        model.trigger('sync', model)
                    }

                // Model not yet present in the pool
                } else {
                    if(this.modelMap[msg.body.name] === undefined) {
                        throw "Unknown model: " + msg.body.name;
                    }
                    _.extend(msg.body.data, {id:msg.body.id})

                    model = new this.modelMap[msg.body.name](msg.body.data);

                    // Request the rest of the model if this wasn't a full dump
                    if(msg.type != 'change_full') {
                        this.peer.sendTo(
                            connection,
                            'request_change_full',
                            this.makeMsg(model)
                        );
                    }
                }

            // Another peer requesting full data dump of model
            } else if (msg.type == 'request_change_full') {

                // Model already in the pool
                if(model == null) {
                    // TODO: add response type for failed model requests
                    console.error('SyncRouter: Request for dump of an unknown model', msg);
                    return
                }

                this.peer.sendTo(
                    connection,
                    'change_full',
                    this.makeMsg(model, true)
                )

            // New model added to a collection
            } else if (msg.type == 'add' || msg.type == 'remove') {
                SyncLList.head(model).trigger(msg.type, model, {noBroadcast:true})
            }
        },

        dataChannelState: function(e) {
            // Our first peer connection. Sync the root model
            if (e.state == 'open' && 
                this.state == this.states.REGISTERED) 
            {
                this.rootModel.sync()
                this.state = this.states.INITIALIZING
            }
        },
        
    },
    

    // A synchronizable model
    SyncModel = Backbone.Model.extend({
        name: 'SyncModel',
        set: function(attrs) {
            Backbone.Model.prototype.set.apply(this, arguments)
            if(attrs['_next'] || attrs['_prev']) {
                console.log('SyncModel: updated linked list')
            }
        },
        sync: function(connection){
            if(SyncRouter.peer.connections.length === 0) {
                this.trigger('sync')
            } else {
                SyncRouter.peer.sendToAll(
                    'request_change_full',
                    SyncRouter.makeMsg(this)
                )
            }
        },

        constructor: function() {
            // Used for collections
            this._next = this._prev = null;

            Backbone.Model.apply(this, arguments);
            this.on('all', this.changeCallback);

            if(arguments[0] !== undefined &&
               arguments[0].id !== undefined)
                this.id = arguments[0].id;
            else
                this.id = this.cid;

            ModelPool.add(this);
        },

        // Linked list methods
        // TODO: Move these to SyncLList node
        next: function(next){
            var nextNode = this.get('_next')
            if(!nextNode) return null
            return ModelPool.get(nextNode.name, nextNode.id)
        },

        prev: function(prev){
            var prevNode = this.get('_prev')
            if(!prevNode) return null
            // Update reference to the previous model in the collection
            return ModelPool.get(prevNode.name, prevNode.id)
        },
        
        trigger: function(eventType, model, opts) {
            var opts = _.extend({ noBroadcast: false }, opts)
            if(!opts.noBroadcast)
                Backbone.Model.prototype.trigger.apply(this, arguments)
        },

        changeCallback: function changeCallback(eventName, target, opts) {
            var uninteresting = ['request', 'sync', 'invalid', 'route'],
                opts = _.extend({ broadcast: true },opts)

            // Broadcast all interesting non-sync originating events
            if (uninteresting.indexOf(eventName) > -1 ||
                eventName.indexOf(':') >= 0 ||
                !opts.broadcast) {
                return;
            }

            console.log('SyncModel: Model changed', target.id, target.changed)
            try {
                SyncRouter.peer.sendToAll(
                    eventName,
                    SyncRouter.makeMsg(target)
                );
            } catch(e) {
                console.error("SyncRouter: error sending update to:", target);
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

    SyncModel.requestName = function(name, model_id) {
        var model = ModelPool.get(name, model_id)
        if (!model) {
            if(!SyncRouter.modelMap[name])
                throw name + " is not a valid model name"

            model = new SyncRouter.modelMap[name]({id: model_id})
        }
        return model
    }
    SyncModel.request = function(model_id) {
        return SyncModel.requestName(this.prototype.name, model_id)
    }

    // A synchronized linked list
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
        add: function(model, opts) {
            var tail = SyncLList.tail(this)

            if(!model.attributes)
                throw "SyncLList: Object not an instance of SyncModel"

            if (model.get('_next') || model.get('_prev')) {
                console.error("SyncLList: This model is already in a collection")
                return
            }

            tail.set('_next', { id: model.id, name: model.name })
            model.set('_prev', { id: tail.id, name: tail.name })
            model._llist = this
            this._tail = model

            // Auto-remove model from list
            model.on('destroy', _.bind(this.remove, this))

            this.trigger('add', model, opts)
            return model
        },

        // Remove a model from collection's linked list
        remove: function(model, opts) {
            var cur = this.next(), prev, next
            while(cur !== model) cur = cur.next()
            if (cur === null) return null

            prev = cur.prev()
            next = cur.next()
            if(next) {
                prev.set('_next', { id: next.id, name: next.name })
                next.set('_prev', { id: prev.id, name: prev.name })
            } else {
                prev.set('_next', null)
                prev._next = undefined
            }
            model.set({'_prev': null, '_next': null})
            model._next = model._prev = undefined

            this.trigger('remove', model, opts)
            return model
        },

        size: function() {
            var i=0, cur = this
            while((next = cur.next()) !== null) {
                cur = next
                i++
            }
            return i
        },

        empty: function() {
            return !this.get('_next')
        },

        // Recursively sync this list by syncing every model in the list
        sync: function() {
            var linkedList = this

            this.once('sync', function listSyncHandler() {
                var next = this.get('_next'),
                    prev = this.get('_prev'),
                    nextNode, prevNode

                if (prev) {
                    this._prev = SyncModel.requestName(prev.name, prev.id)
                }
                // Reached end of linked list
                if (!next) {
                    // TODO: Remove sync_list when linked list nodes are separated from models
                    console.log("SyncLList: sync reached end of list", this)
                    linkedList.trigger('sync_list', this)
                    return
                }

                nextNode = SyncModel.requestName(next.name, next.id)
                nextNode.once('sync', listSyncHandler)
                this._next = nextNode
                nextNode.sync()
            })
            SyncModel.prototype.sync.apply(this,arguments)
        },
    });
    
    // Class methods for working with linked lists
    _.extend(SyncLList, {
        head : function(cur) {
            if(cur._llist) return cur._llist

            var prev
            while((prev = cur.prev()) !== null) cur = prev
            return cur
        },

        tail : function(cur) {
            var next
            while((next = cur.next()) !== null) cur = next
            return cur
        },

    })

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
