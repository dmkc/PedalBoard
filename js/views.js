define(
    ['util', 'syncmodel', 'controllers', 'pedals'], 
    function(util, Backbone, Controllers, Pedals) {
        // A generic pedal that notifies its model of parameter changes
        var PedalView = Backbone.View.extend({
                el: function() {
                    return this.template();
                },

                events: {
                    "change": "changeHandler"
                },

                changeHandler: function(e) {
                    var node = e.target,
                        val;

                    if (node.className.indexOf('bypass') !== -1)
                        val = node.checked;
                    else 
                        val = e.target.value;

                    this.model.set(e.target.className, val);
                }
            }),

            CompressorView = PedalView.extend({
                template: function() {
                    return $('#template_compressor').clone().removeAttr('id');
                },

                init: function() {
                    return this;
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
                    'click #add_compressor' : 'addPedal',
                    'click #add_stereochorus' : 'addPedal',
                    'click #play_sample_0'  : 'playSample',
                    'click #live_input'     : 'liveInput',
                    'click #stop_input'     : 'stopInput'
                },

                init: function() {
                    this.controller = Controllers.PedalBoard.init();
                    this.dom = {
                        pedals: this.$('#pedals')
                    }
                    this.views = [];
                    return this;
                },

                addPedal: function(e) {
                    var view, 
                        model = new Pedals.PedalModel();

                    if (e.target.id == 'add_compressor') {
                        this.controller.addPedal('Compressor', model);

                        view = new CompressorView({
                            model: model
                        }).init();
                    } else if (e.target.id == 'add_stereochorus') {
                        this.controller.addPedal('StereoChorus', model);

                        view = new StereoChorusView({
                            model: model
                        });
                    }
                    model.on('change:bypass', this.bypassPedal, this);
                    this.dom.pedals.append(view.$el);
                },

                bypassPedal: function(model) {
                    this.controller.bypassPedal(model, model.get('bypass'));
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
