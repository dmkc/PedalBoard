define(
    ['util', 'rtc/syncmodel', 'audio/pedals', 'audio/pedalboard', 'models'], 
    function(util, Backbone, Pedals, PedalBoard, Models) {
        // A generic pedal that notifies its model of parameter changes
        var PedalView = Backbone.View.extend({
                el: function() {
                    return this.template();
                },

                init: function() {
                    this.model.on('change', this.modelChange, this);
                    this.$('.remove').on('click', util.proxy(this.destroy,this));
                    return this;
                },

                events: {
                    "change": "changeHandler",
                },

                changeHandler: function(e) {
                    var node = e.target,
                        val;

                    if (node.className.indexOf('bypass') !== -1)
                        val = node.checked;
                    else 
                        val = e.target.value;

                    this.model.set(e.target.className, val);
                },

                destroy: function() {
                    this.$el.remove();
                    this.model.destroy();
                },

                modelChange: function(model) {
                    console.log('PEDAL VIEW: model param change');
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
                el: 'body',
                dom: {},
                // TODO: switch to touch/tap events with zepto
                events: {
                    'click #add_compressor'   : 'addPedal',
                    'click #add_stereochorus' : 'addPedal',
                    'click #play_sample_0'    : 'playSample',
                    'click #live_input'       : 'liveInput',
                    'click #stop_input'       : 'stopInput'
                },

                init: function() {
                    this.controller = PedalBoard.PedalBoard.init()
                    this.pedalList = new Backbone.SyncLList({id:'pedalList'})
                    this.dom = {
                        pedals: this.$('#pedals')
                    }
                    this.views = [];
                    return this;
                },

                addPedal: function(e) {
                    var view, 
                        params; 

                    if (e.target.id == 'add_compressor') {
                        params = new Models.CompressorModel();

                        view = new CompressorView({
                            model: params
                        }).init();
                    } else if (e.target.id == 'add_stereochorus') {
                        params = new Models.StereoChorusModel();

                        view = new StereoChorusView({
                            model: params
                        }).init();
                    }
                    this.dom.pedals.append(view.$el);
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
            })
    return {
        CompressorView: CompressorView,
        StereoChorusView: StereoChorusView,
        PedalBoardView: PedalBoardView
    }
})
