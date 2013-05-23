define(
    ['util', 'syncmodel'], function(util, Backbone) {
    // A model used by all pedals
    var PedalNode = function(){},

        PedalModel = Backbone.SyncModel.extend({
            name: 'PedalModel',
        });

    // A generic pedal others inherit from
    PedalNode.prototype = {
        // Generic change handler useful when there's only one node which
        // is both the input and output.
        paramChange: function(e, node) {
            var changes = e.changedAttributes(),
                node = node || this.input;

            for(var c in changes) {
                if (node[c] !== undefined) {
                    node[c].value = changes[c];
                }
            }
        },
    };

    return {
        PedalModel: PedalModel,

        CompressorNode: util.inherit(PedalNode, {
            init: function(context, model) {
                this.model = model;
                this.context = context;
                this.model.on({
                    'change': this.paramChange
                }, this);

                this.input = context.createDynamicsCompressor();
                this.output = context.createGainNode();
                this.input.connect(this.output);
                return this; 
            },

            paramChange: function(e) {
                var changes = e.changedAttributes();

                if(changes['gain'] !== undefined) {
                    this.output.gain.value = changes['gain'];
                    delete changes.gain;
                }

                PedalNode.prototype.paramChange.call(this, e, this.input);
            }

        }),
    };
});
