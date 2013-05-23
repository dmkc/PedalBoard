/* Playing around with Web Audio. Should be useful for the metronome
 * track
 */
define(
    ['buffer-loader', 'util', 'syncmodel', 'pedals'], 
    function(BufferLoader, util, Backbone, Pedals) {
        var PedalBoardModel = Backbone.SyncModel.extend({
            name: 'PBModel'
        });

        var PedalBoard = {
            init: function() {
                // Fix up prefixing
                var that = this;
                this.pedals = [];
                this.sampleSources = [];
                this.sampleBuffers = [];

                window.AudioContext = window.AudioContext || window.webkitAudioContext;
                this.context = new AudioContext();
                // TODO: turn this into a gain pedal
                this.masterGain = this.context.createGainNode();
                this.masterGain.connect(this.context.destination);
                this.source = this.context.createBufferSource();


                // Load a few samples in the highly unlikely case the user 
                // doesn't have an American Strat kicking around
                new BufferLoader(
                    this.context,
                    [
                        //'/samples/demarco1.wav',
                        '/samples/gibson_E_maj.wav'
                    ],
                    function loadedBuffers(buffers) {
                        var samples = that.sampleBuffers;
                        for(var b in buffers) {
                            samples.push(buffers[b]);
                        }
                    }
                ).load();

                return this;
            },

            // Add a pedal to the end of the pedal chain
            // TODO: reordering of pedals
            addPedal: function(name) {
                var pedalNode,
                    pedalModel,
                    order = this.pedals.length;

                if(Pedals[name+'Node'] === undefined) {
                    throw 'No such pedal exists:' + name;
                } else {
                    pedalModel = new Pedals.PedalModel();
                    pedalNode = new Pedals[name+'Node']().init(
                        this.context, 
                        pedalModel);
                    this.pedals.push(pedalNode);
                    this.reconnectPedals();
                }
            },

            reconnectPedals: function() {
                var sources = this.pedals.slice(0),
                    curNode,
                    nextNode,
                    p = 0;

                // There is always at least masterGain to connect into
                sources.push({
                    input:  this.masterGain,
                    output: this.masterGain,
                });
                this.source.disconnect();
                this.source.connect(sources[p].input);

                for(; p<sources.length; p++) {
                    cur = sources[p];
                    // If this is the last pedal, route it into audiocontext
                    next = sources[p+1] || {
                        input: this.context.destination,
                        output: this.context.destination,
                    };
                    cur.output.disconnect();
                    cur.output.connect(next.input);
                }
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

        }
    _.extend(PedalBoard, Backbone.Events);

    return {
        PedalBoard: PedalBoard
    };
});
