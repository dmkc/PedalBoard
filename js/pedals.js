define(
    ['util', 'syncmodel'], function(util, Backbone) {
    // Generic pedal prototypes
    var PedalNode = function(){},

        PedalModel = Backbone.SyncModel.extend({
            name: 'PedalModel',
        });


    PedalNode.prototype = {
        // Generic change handler useful if there's only one node that's 
        // both the input and output.
        parameterChange: function(e, node) {
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

        // Compressor
        CompressorView: Backbone.View.extend({
            init: function() {

            }
        }),

        CompressorNode: util.inherit(PedalNode, {
            init: function(context, model) {
                this.model = model;
                this.context = context;
                this.model.on({
                    'change': this.parameterChange
                }, this);

                this.input = context.createDynamicsCompressor();
                this.output = context.createGainNode();
                this.input.connect(this.output);
                return this; 
            },

            parameterChange: function(e) {
                var changes = e.changedAttributes();

                if(changes['gain'] !== undefined) {
                    this.output.gain.value = changes['gain'];
                    delete changes.gain;
                }

                PedalNode.prototype.parameterChange.call(this, e, this.input);
            }

        }),
    };
});
