define(
    ['rtc/syncmodel', 'audio/pedals', 'models', 'mobile-range-slider'],
    function(Backbone, Audio, Models, MobileRangeSlider) {
        // A generic pedal view with generic restore and change methods.
        var PedalView = Backbone.View.extend({
                el: function() {
                    return this.template();
                },

                init: function() {
                    var that = this
                    this.model.on('destroy', _.bind(this.destroy,this));
                    this.$('.remove').on('click', _.bind(function(){
                        this.model.destroy()}, this));

                    // Use pretty sliders where possible
                    this.$('input[type=range]').each(function(){
                        this.addEventListener('change', that.changeHandler.bind(that))
                        new MobileRangeSlider(this)
                    })
                    return this;
                },

                /*
                events: {
                    "change": "changeHandler",
                },
                */

                // Change model in response to changes in UI
                changeHandler: function(e) {
                    var node = e.target,
                        val;

                    if (node.className.indexOf('bypass') !== -1)
                        val = node.checked;
                    else
                        val = e.target.value;

                    this.model.set(e.target.className, val);
                },

                // Update UI in response to model changes
                render: function(model) {
                    var attrs = model.changedAttributes()
                    this.restore(attrs)
                },

                // Restore view settings from the model
                restore: function(attrs) {
                    var attrs = attrs || this.model.attributes,
                        el;

                    for(var a in attrs) {
                        el = this.$('.' + a)
                        el.val(attrs[a])
                        if(el.length > 0) el.get(0).dispatchEvent(new Event('change'))
                    }
                },

                destroy: function() {
                    this.$el.remove();
                },

            }),

            CompressorView = PedalView.extend({
                template: function() {
                    return $('#template-compressor').clone().removeAttr('id');
                },

                changeHandler: function(e) {
                    PedalView.prototype.changeHandler.apply(this, arguments);
                }

            }),

            StereoChorusView = PedalView.extend({
                template: function() {
                    return $('#template-stereochorus').clone().removeAttr('id');
                },

                changeHandler: function(e) {
                    PedalView.prototype.changeHandler.apply(this, arguments);
                }

            }),

            // The main app view
            PedalBoardView = Backbone.View.extend({
                el: '#pedal-view',
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
                    this.pedalList = this.model
                    this.dom = {
                        pedals: this.$('#pedals'),
                    }

                    this.$('#add_compressor, #add_stereochorus')
                        .on('click', _.bind(function(e){
                            this.addPedalModel(e.target.id.substr(4))
                        },this))

                    this.views = [];
                    this.pedalList.once('sync_list', _.bind(this.restorePedals,this))
                    // TODO: Replace with ScreenStack call
                    this.pedalList.on('add', _.bind(this.addPedalView,this))

                    // Init audio engine and add pedals when pedal list updates
                    // TODO: Move this into AppView init, and instead watch for changes
                    // in the PlaybackModel or whatever model keeps track of playback state
                    if (!existingSession) {
                        this.controller = Audio.PedalController.init()
                        this.pedalList.on(
                            'add', 
                            this.controller.addPedal.bind(this.controller))
                    }

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
                            model: model,
                            title: "Compressor",
                        }).init()
                    } else if (name == 'stereochorus') {
                        view = new StereoChorusView({
                            model: model,
                            title: "Stereo Chorus",
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

            // A pedal menu!!
            PedalMenuItem = Backbone.View.extend({
                el: function() {
                    return this.template();
                },

                template: function() {
                    return $('#template-pedal-menu-item').clone().removeAttr('id')
                },

                init: function() {
                    this.model.on('destroy', this.destroy.bind(this))
                    this.render()

                    return this
                },

                render: function() {
                    this.$('.pedal-menu-item-title').text(
                        // TODO: need model title
                        this.model.name
                    )
                },
                destroy: function(){
                    this.$el.remove()
                },

            }),

            PedalMenuView = Backbone.View.extend({
                el: '#pedal-menu',
                dom: {},
                events: {

                },

                init: function(){
                    this.dom = {
                        menuItems: this.$('#pedal-menu-items')
                    }
                    this.model.on('sync_list', this.initItems.bind(this))
                    this.model.on('add', this.addMenuItem.bind(this))
                    return this
                },

                initItems: function(){
                    console.log('PedalMenuView: creating menu items')
                    var cur = this.model,
                        item

                    while((cur = cur.next()) !== null) {
                        item = this.addMenuItem(cur)
                    }
                },

                addMenuItem: function(model){
                    var item = new PedalMenuItem({ model: model }).init()
                    this.dom.menuItems.append(item.$el)
                    return item
                }
            }),

            // Primary view that sets up the entire app
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
                                "new"   : that.start.bind(that),
                                "s/:sid": that.join.bind(that),
                                "exit"  : that.shutdown,
                            }
                        }),
                        router = this.router = new Router()


                    // Init DOM stuff
                    this.dom = {
                        session_id: this.$('#session_id'),
                        sessionMenu: $('#session-menu'),
                    }

                    // Set up the pedals linked list

                    // Initialize the app once the router is configured
                    Backbone.SyncRouter.on('init', _.bind(function() {
                        console.log("Sync router initialized")

                        var pedalList = this.pedalList = Backbone.SyncLList.request('pedalList')
                        // Initialize pedal view
                        that.PedalBoardView = new PedalBoardView({model: pedalList }).init(this.existingSession)

                        // Initialize pedal menu
                        that.PedalMenu = new PedalMenuView({model: pedalList}).init()

                        // Initialize audio engine

                        // Synchronize pedal list, which will init everything else
                        pedalList.sync()

                        history.pushState(
                            { session_id: this.peer.session_id },
                            "",
                            "/s/"+this.peer.session_id)
                    }, Backbone.SyncRouter))

                    var routerInit = Backbone.history.start({pushState: true, root:'/'})

                    return this
                },

                // SESSION CONTROL ///////////////////
                // TODO: Move this into a SessionView?
                start: function(session_id) {
                    this.dom.sessionMenu.removeClass('active')
                    Backbone.SyncRouter.init(session_id)
                },

                join: function(session_id) {
                    Backbone.SyncRouter.existingSession = true
                    this.start(session_id)
                },

                shutdown: function() {
                    Backbone.SyncRouter.shutdown()
                },

                // UI mappings ////////
                sessionJoin: function(e){
                    e.preventDefault()
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
