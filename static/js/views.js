define(
    ['rtc/syncmodel', 'audio/pedals', 'audio/pedalboard', 'models'],
    function(Backbone, Pedals, PedalBoard, Models) {
        // A generic pedal that notifies its model of parameter changes
        var PedalView = Backbone.View.extend({
                el: function() {
                    return this.template();
                },

                init: function() {
                    this.model.on('change', this.modelChange, this);
                    this.model.on('destroy', _.bind(this.destroy,this));
                    this.$('.remove').on('click', _.bind(function(){
                        this.model.destroy()}, this));

                    return this;
                },

                events: {
                    "change": "changeHandler",
                },

                // Set model in response to changes in UI
                changeHandler: function(e) {
                    var node = e.target,
                        val;

                    if (node.className.indexOf('bypass') !== -1)
                        val = node.checked;
                    else
                        val = e.target.value;

                    this.model.set(e.target.className, val);
                },

                // Update UI in response to model
                modelChange: function(model) {
                    var attrs = model.changedAttributes()
                    this.restore(attrs)
                },

                // Restore UI settings from a model
                restore: function(atrs) {
                    var attrs = attrs || this.model.attributes

                    for(var a in attrs) {
                        this.$('.' + a).val(attrs[a])
                    }
                },

                destroy: function() {
                    this.$el.remove();
                },

            }),

            CompressorView = PedalView.extend({
                template: function() {
                    return $('#template_compressor').clone().removeAttr('id');
                },

                changeHandler: function(e) {
                    PedalView.prototype.changeHandler.apply(this, arguments);
                }

            }),

            StereoChorusView = PedalView.extend({
                template: function() {
                    return $('#template_stereochorus').clone().removeAttr('id');
                },

                changeHandler: function(e) {
                    PedalView.prototype.changeHandler.apply(this, arguments);
                }

            }),

            // The main app view
            PedalBoardView = Backbone.View.extend({
                el: '#pedal_view',
                dom: {},
                // TODO: switch to touch/tap events with zepto
                events: {
                    'click #play_sample_0'    : 'playSample',
                    'click #live_input'       : 'liveInput',
                    'click #stop_input'       : 'stopInput',
                    /*
                    'click #add_compressor'   : 'addPedalModel',
                    'click #add_stereochorus' : 'addPedalModel',
                    */
                },

                init: function(existingSession) {
                    this.controller = !existingSession || PedalBoard.PedalBoard.init()
                    this.dom = {
                        pedals: this.$('#pedals'),
                    }

                    this.$('#add_compressor, #add_stereochorus')
                        .on('click', _.bind(function(e){
                            this.addPedalModel(e.target.id.substr(4))
                        },this))

                    this.views = [];
                    // Set up the pedals linked list
                    this.pedalList = Backbone.SyncLList.request('pedalList')
                    this.pedalList.once('sync_list', _.bind(this.restorePedals,this))
                    this.pedalList.on('add', _.bind(this.addPedalView,this))
                    this.pedalList.sync()

                    return this
                },

                // Set up pedals from linked list
                restorePedals: function() {
                    var cur = this.pedalList.next(), view

                    while(cur != null) {
                        view = this.addPedalView(cur)
                        view.restore()
                        cur = cur.next()
                    }
                },

                addPedalModel: function(name) {
                    var model

                    if (name == 'compressor') {
                        model = new Models.CompressorModel()
                    } else if (name == 'stereochorus') {
                        model = new Models.StereoChorusModel()
                    }
                    this.pedalList.add(model)
                    return model
                },


                // TODO: this screams declarative.
                // TODO: Fix ugly addPedalView/Model split
                addPedalView: function(model) {
                    var view,
                        // Figure out view name from model name
                        name = model.name.substr(0, model.name.length-5).toLowerCase(),
                        that = this

                    if (name == 'compressor') {
                        view = new CompressorView({
                            model: model
                        }).init()
                    } else if (name == 'stereochorus') {
                        view = new StereoChorusView({
                            model: model
                        }).init()
                    }
                    this.dom.pedals.append(view.$el);

                    return view
                },

                playSample: function(e) {
                    this.controller.playSample(0);
                },
                liveInput: function(){
                    this.controller.liveInput();
                },
                stopInput: function() {
                    this.controller.stopInput();
                }
            }),

            AppView = Backbone.View.extend({
                el: 'body',
                dom: {},
                events: {
                    'click #session_new'      : 'sessionJoin',
                    'click #session_join'     : 'sessionJoin',
                    'click #session_exit'     : 'sessionExit',
                },

                init: function(session_id) {
                    // Set up routing
                    var that = this,
                        Router = Backbone.Router.extend({
                            routes: {
                                "new"   : that.start,
                                "s/:sid": _.bind(that.join, that),
                                "exit"  : that.shutdown,
                            }
                        }),
                        router = this.router = new Router()

                    var routerInit = Backbone.history.start({pushState: true, root:'/'})

                    // Init DOM stuff
                    this.dom = {
                        session_id: this.$('#session_id'),
                    }

                    // Initialize syncrouter
                    Backbone.SyncRouter.on('init', _.bind(function() {
                        console.log("Sync router initialized")
                        window.PedalBoardView = new PedalBoardView().init(this.existingSession)
                        history.pushState(
                            { session_id: this.peer.session_id },
                            "",
                            "/s/"+this.peer.session_id)
                    }, Backbone.SyncRouter))

                    return this
                },

                start: function(session_id) {
                    Backbone.SyncRouter.init(session_id)
                },

                join: function(session_id) {
                    this.existingSession = true
                    this.start(session_id)
                },

                shutdown: function() {
                    Backbone.SyncRouter.shutdown()
                },

                // UI mappings ////////
                sessionJoin: function(){
                    var sid = this.dom.session_id.val().trim()

                    if(!sid) {
                        this.router.navigate('new', {trigger: true})
                    } else {
                        this.router.navigate('s/' + sid, {trigger:true})
                    }
                },

                sessionExit: function(){
                    this.router.navigate('exit', {trigger: true})
                },
            })
    return {
        CompressorView: CompressorView,
        StereoChorusView: StereoChorusView,
        PedalBoardView: PedalBoardView,
        AppView: AppView
    }
})