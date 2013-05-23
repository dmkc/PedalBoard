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
                    this.model.set(e.target.className, e.target.value);
                }
            }),

            CompressorView = PedalView.extend({
                template: function() {
                    return $('#template_compressor').removeAttr('id');
                },

            }),

            // The main app view
            PedalBoardView = Backbone.View.extend({
                el: 'body',
                dom: {},
                // TODO: switch to touch/tap events with zepto
                events: {
                    'click #add_compressor': 'addPedal',
                    'click #play_sample_0': 'playSample',
                    'click #live_input': 'liveInput',
                    'click #stop_input': 'stopInput'
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
                    var view, model;


                    if (e.target.id == 'add_compressor') {
                        model = new Pedals.PedalModel();
                        this.controller.addPedal('Compressor', model);
                        view = new CompressorView({
                            model: model
                        });
                        this.dom.pedals.append(view.$el);
                    }

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
        PedalBoardView: PedalBoardView
    }
})
