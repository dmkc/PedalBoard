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


    var Pedals = {
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

        // Controller logic for manipulating pedal audio nodes.
        PedalController: _.extend({
            init: function() {
                // Fix up prefixing
                var that = this;
                // TODO: Drop the array and use linked list instead
                this.pedals = [];
                this.sampleSources = [];
                this.sampleBuffers = [];

                window.AudioContext = window.AudioContext || window.webkitAudioContext;
                this.context = new AudioContext();
                // TODO: turn this into a gain pedal?
                this.masterGain = this.context.createGainNode();
                this.masterGain.connect(this.context.destination);
                this.source = this.context.createBufferSource();

                // Load a few samples in the highly unlikely case the user 
                // doesn't have an American Strat kicking around
                new BufferLoader(
                    this.context,
                    [
                        '/samples/demarco1.wav',
                        '/samples/gibson_E_maj.wav'
                    ],
                    function loadedBuffers(buffers) {
                        var samples = that.sampleBuffers;
                        for(var b in buffers) {
                            samples.push(buffers[b]);
                        }
                    }
                ).load();

                // Listen for new PedalModel objects and add corresponding
                // audio nodes.
                // TODO: add models to a linked list instead
                Backbone.ModelPool.on('add', this.addPedal,this)

                return this;
            },

            // Add a pedal to the end of the pedal chain
            addPedal: function(model, index) {
                var pedalNode,
                    order = this.pedals.length,
                    // Append to the end of list by default
                    index = index || this.pedals.length,
                    name = model.name.substr(0, model.name.length-5);

                // Figure out pedal based on model name
                if(Pedals[name+'Node'] === undefined) {
                    return;
                } else {
                    pedalNode = new Pedals[name+'Node']().init(
                        this.context, 
                        model);
                    this.pedals.splice(index, 0, pedalNode);
                    this.reconnectPedals();
                }
                model.on('change:bypass', this.bypassPedal, this);
                model.on('destroy', this.removePedal, this);
            },

            removePedal: function(model) {
                var index = this.getPedalIndex(model)+1
                this.bypassPedal(model);
                this.pedals.splice(index, 1);
            },

            // Reconnect all pedals according to their order in the
            // source list
            reconnectPedals: function() {
                var sources = this.getSources(),
                    curNode,
                    nextNode;

                this.source.disconnect();

                for(var p=0; p<sources.length-1; p++) {
                    cur = sources[p];
                    if (cur.model && cur.model.get('bypass')) continue;
                    // If this is the last pedal, route it into audiocontext
                    next = sources[p+1];
                    cur.output.disconnect();
                    cur.output.connect(next.input);
                }
            },

            // Disconnect pedal from node chain.
            bypassPedal: function(model) {
                var index =  this.getPedalIndex(model)+1,
                    bypass = model.get('bypass'),
                    sources = this.getSources(),
                    inNode = this.getPrev(index),
                    outNode = this.getNext(index)

                inNode.output.disconnect();
                if(bypass) {
                    sources[index].output.disconnect();
                    inNode.output.connect(outNode.input);
                } else {
                    inNode.output.connect(sources[index].input);
                    sources[index].output.connect(outNode.input);
                }
            },

            // Return list of pedals, with source at the head and masterGain
            // at the end of the list.
            // TODO: Convenient but confusing.
            getSources: function() {
                // Clone source array
                var sources = this.pedals.slice(0)

                sources.push({
                    input:  this.masterGain,
                    output: this.masterGain,
                });
                sources.unshift({
                    input: this.source,
                    output: this.source,
                });
                return sources;
            },

            // Get index of pedal given pedal's model
            getPedalIndex: function(model) {
                for(var p=0; p<this.pedals.length; p++) {
                    if(this.pedals[p].model === model) 
                        return p;
                }
                return -1;
            },

            // Get the next non-bypassed pedal
            getNext: function(index) {
                var pedals = this.getSources();
                while(pedals[index+1].model &&
                      pedals[index+1].model.get('bypass')) 
                    index++;

                return pedals[index+1];
            },

            // Get the previous non-bypassed pedal
            getPrev: function(index) {
                var pedals = this.getSources();
                while(pedals[index-1].model &&
                      pedals[index-1].model.get('bypass')) 
                    index--;

                return pedals[index-1];
            },

            // Play one of the pre-loaded samples in a loop
            playSample: function(sample_id) {
                this.stopInput();

                var sample = this.context.createBufferSource();
                sample.buffer = this.sampleBuffers[sample_id];
                sample.loop = true;
                sample.start(0);
                this.source = sample;
                this.reconnectPedals();
            },

            // Stop all input, live or a sample
            stopInput: function() {
                if (this.source.stop) this.source.stop(0);
                this.source.disconnect();
            },

            // Switch context to live input
            liveInput: function() {
                var that = this;
                this.stopInput();

                if(this.live) {
                    this.source = this.live;
                    this.reconnectPedals();
                } else {
                    navigator.webkitGetUserMedia({audio: true}, function(stream) {
                        that.live = that.context.createMediaStreamSource(stream);
                        that.source = that.live;
                        that.reconnectPedals();
                    });
                }
            }

        }, Backbone.Events)
    };

    return Pedals
});
