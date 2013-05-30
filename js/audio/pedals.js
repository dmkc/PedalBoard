define(
    ['util', 'rtc/syncmodel', 'buffer-loader'], function(util, Backbone, BufferLoader) {
    // A model used by all pedals
    var PedalNode = function(){};

    // A generic pedal others inherit from
    PedalNode.prototype = {
        init: function() {
            this.bypass = false;
        },
        // Generic change handler useful when there's only one node which
        // is both the input and output.
        paramChange: function(e, node) {
            var changes = e.changedAttributes(),
                node = node || this.input;

            for(var c in changes) {
                if (node[c] !== undefined) {
                    node[c].value = parseFloat(changes[c]);
                }
            }
        },
    };


    return {
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

        StereoChorusNode: util.inherit(PedalNode, {
            init: function(context, model) {
                this.model = model;
                this.context = context;
                this.model.on({
                    'change': this.paramChange
                }, this);

                var splitter = context.createChannelSplitter(2);
                var merger = context.createChannelMerger(2);
                var inputNode = context.createGainNode();
                var delayLNode = context.createDelayNode();
                var delayRNode = context.createDelayNode();
                var osc = context.createOscillator();
                var scldepth = context.createGainNode();
                var scrdepth = context.createGainNode();

                inputNode.connect( splitter );

                delayLNode.delayTime.value = 0.005;
                delayRNode.delayTime.value = 0.005;
                scldelay = delayLNode;
                scrdelay = delayRNode;
                splitter.connect( delayLNode, 0 );
                splitter.connect( delayRNode, 1 );

                // depth of change to the delay:
                scldepth.gain.value = 0.0005 
                scrdepth.gain.value = -0.0005; 

                osc.type = osc.SINE;
                osc.frequency.value = 0.5;
                scspeed = osc;

                osc.connect(scldepth);
                osc.connect(scrdepth);

                scldepth.connect(delayLNode.delayTime);
                scrdepth.connect(delayRNode.delayTime);

                delayLNode.connect( merger, 0, 0 );
                delayRNode.connect( merger, 0, 1 );

                osc.start(0);

                this.input = inputNode;
                this.output = merger;

                this.scldepth = scldepth;
                this.scrdepth = scrdepth;
                this.delayLNode = delayLNode;
                this.delayRNode = delayRNode;
                this.osc = osc;

                return this;
            },

            paramChange: function(e) {
                var changes = e.changedAttributes();

                if(changes['depth'] !== undefined) {
                    this.scldepth.gain.value = parseFloat(changes['depth']);
                    this.scrdepth.gain.value = -parseFloat(changes['depth']);
                } 
                if(changes['delay'] !== undefined) {
                    this.delayLNode.delayTime.value = parseFloat(changes['delay']);
                    this.delayRNode.delayTime.value = parseFloat(changes['delay']);
                } 
                if(changes['speed'] !== undefined) {
                    this.osc.frequency.value = parseFloat(changes['speed']);
                } 
            }
        }),
    };
});
