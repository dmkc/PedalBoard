define(
    ['util', 'syncmodel', 'controllers'], 
    function(util, Backbone, Controllers) {
        return {
            CompressorView: Backbone.View.extend({
                template: function() {
                    return $('#template_compressor').removeAttr('id');
                },

                el: function() {
                    return this.template();
                }
            }),

            // The main app view
            PedalBoardView: Backbone.View.extend({
                el: 'body',
                // TODO: switch to touch/tap events with zepto
                events: {
                    'click #add_compressor': 'addPedal',
                    'click #play_sample_0': 'playSample',
                    'click #live_input': 'liveInput',
                    'click #stop_input': 'stopInput'
                },

                init: function() {
                    this.controller = Controllers.PedalBoard.init();
                    return this;
                },

                addPedal: function(e) {
                    if (e.target.id == 'add_compressor') {
                        this.controller.addPedal('Compressor');
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
        };
})
