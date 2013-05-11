define(['master', 'slave', 'backbone'], function(Master, Slave, Backbone) {
    var peers = {},
        subscriptions = {};


    // Data structure for keeping track of model instances and their
    // subscriptions. Subs because I can't spell "subscription" without typos
    PeerSubs = {
        // TODO: clean up destroyed models and dead clients
        add: function(model, client_id) {
            var subscr,
                curModel;

            if (subscriptions[model.name] === undefined) {
                subscriptions[model.name] = {};
            }
            curModel = subscriptions[model.name];

            if (curModel[model.id] === undefined) {
                curModel[model.id] = {};
            }

            subscr = curModel[model.id][client_id] = {
                model: model,
                sendAll: true
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

    PeerRouter = {
        // Map model names to class names for re-instantiation on other clients
        modelMap: {},

        // TODO: peer states
        init: function(opts) {
            this.peerOpts = _.extend({}, opts);
            this.peerOpts.master = this.peerOpts.master || false;

            this.peer =  (this.peerOpts.master) ? new Master() : new Slave();
        },

        broadcast: function(obj) {
            // TODO: handle cases of being disconnected
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
                        this.send(model, p);
                        subscribers[p].sendAll = false;
                    }
                }
            }
        },

        subscribeModel: function(model, client_id) {
            // TODO: clean up disconnected peers
            PeerSubs.add(model, client_id);
        },

        send: function(obj, client_id) {
            this.peer.sendTo(client_id, JSON.stringify(
                this.flatten(obj)));

        },

        // Prepare collection or model for transmission including only those
        // models the client is subscribed to.
        flatten: function(obj, client_id) {
            if(obj instanceof Backbone.PeerModel) {
                return this.flattenModel(obj);
            } else if (obj instanceof Backbone.PeerCollection) {
                return this.flattenCollection(obj, client_id);
            }
        },

        flattenModel: function(model, sendAll) {
            var data;
            
            if (sendAll) {
                data = _.clone(model.attributes);
            } else {
                data = model.changedAttributes() || _.clone(model.attributes);
            }

            return {
                type: 'model',
                name: model.name,
                id:  model.id,
                data: data
            };
        },

        flattenCollection: function(col, client_id) {
            var models = [], modelOpts;

            for(var m in col.models) {
                modelOpts = this.getModel(col.models[m], client_id);
                if (modelOpts == null) continue;

                models.push(this.flattenModel(modelOpts.model, 
                                              modelOpts.sendAll));         
            }

            return {
                type: 'collection',
                name: col.name,
                models: models
            }
        }

        
    }

    
    function changeCallback(eventName, target, opts) {
        var uninteresting = ['request', 'sync', 'invalid', 'route'];

        // Broadcast all interesting non-sync originating events
        if (eventName in uninteresting ||
            eventName.indexOf(':') >= 0 || 
            opts.synced === true) {
            return;
        }
        PeerRouter.broadcast(target);
    }

    // A synchronizable model
    Backbone.PeerModel = Backbone.Model.extend({
        constructor: function() {
            this.on('all', changeCallback);
            Backbone.Model.apply(this, arguments);
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

    window.startTest = function() {
        PeerRouter.init({master:true})
        var model = new TestModel();
        model.set('blah', 123);

        setTimeout( function(){
            model.subscribe(PeerRouter.peer.connections[0].client_id);
        }, 1000);

        window.model = model;
        window.coll = TestCollection;
    }

    return Backbone;
});
