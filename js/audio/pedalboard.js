/* Playing around with Web Audio. Should be useful for the metronome
 * track
 */
define(
    ['buffer-loader', 'util', 'rtc/syncmodel', 'audio/pedals'], 
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
                Backbone.ModelPool.on('add', this.addPedal,this)

                return this;
            },

            // Add a pedal to the end of the pedal chain
            addPedal: function(model, index) {
                var pedalNode,
                    order = this.pedals.length,
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
            },

            removePedal: function(index) {
                return this.pedals.splice(index, 1);
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
                    // If this is the last pedal, route it into audiocontext
                    next = sources[p+1];
                    cur.output.disconnect();
                    cur.output.connect(next.input);
                }
            },

            // Disconnect pedal from node flow. 
            // `model` can be either a reference to a pedal model, or an
            // index into the pedal array
            bypassPedal: function(model, bypass) {
                var index = (isNaN(new Number(index))) 
                            ? this.getPedalIndex(model)+1
                            : ++model,
                    bypass = (bypass !== undefined) ? bypass : true,
                    sources = this.getSources(),
                    inNode = this.getPrev(index),
                    outNode = this.getNext(index)

                inNode.output.disconnect();
                if(bypass) {
                    sources[index].output.disconnect();
                    sources[index].bypass = true;
                    inNode.output.connect(outNode.input);
                } else {
                    sources[index].bypass = false;
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
                    bypass: false
                });
                sources.unshift({
                    input: this.source,
                    output: this.source,
                    bypass: false
                });
                return sources;
            },

            // Get index in the array based on pedal's model. Used by the main
            // view which has no idea what pedals are
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
                while(pedals[index+1].bypass) index++;

                return pedals[index+1];
            },

            // Get the previous non-bypassed pedal
            getPrev: function(index) {
                var pedals = this.getSources();
                while(pedals[index-1].bypass) index--;

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

        }
    _.extend(PedalBoard, Backbone.Events);

    return {
        PedalBoard: PedalBoard
    };
});