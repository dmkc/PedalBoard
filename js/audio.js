/* Playing around with Web Audio. Should be useful for the metronome
 * track
 */
define(
    ['buffer-loader', 'util', 'syncmodel'], 
    function(BufferLoader, util, Backbone) {
        var context;
        var bufferLoader,
            gainNode;

        var PedalBoardModel = Backbone.SyncModel.extend({
            name: 'PBModel'
        });

        var PedalBoard = function() {};
        PedalBoard.prototype = 

        function init() {
            // Fix up prefixing
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            context = new AudioContext();
            window.context = context;

            bufferLoader = new BufferLoader(
                context,
                [
                    '/samples/tr707/Bdrum1.wav',
                    '/samples/tr707/Ride4.wav',
                    '/samples/tr707/Hhclose1.wav',
                    '/samples/tr707/Snare2.wav',
                    '/samples/tr707/Hhopen1.wav',
                ],
                finishedLoading
            );

            bufferLoader.load();
        }

        function finishedLoading(bufferList) {
            // Create two sources and play them both together.
            /*
            var bd = context.createBufferSource();
            var ride = context.createBufferSource();
            bd.buffer = bufferList[0];
            ride.buffer = bufferList[1];
            */

            function playSound(track, time, gain) {
                //var source = track.source,
                var source = context.createBufferSource(),
                    gain = gain || 1;

                source.buffer = track.buffer;
                source.connect(out);
                source.gain.value = Math.cos((1-gain) * 0.5 * Math.PI);

                //if (source.playbackState != 0) source.stop(0);
                if (!source.start) source.start = source.noteOn;
                source.start(time);
            }

            var bd = bufferList[0],
                ride = bufferList[1],
                hihat = bufferList[2],
                openhh = bufferList[4],
                snare = bufferList[3],
                rimshot = bufferList[5];
            var tempo = 115;


            var TrackModel = {};

            function Track(notes, buffer) {
                this.notes = notes;
                this.buffer = buffer;

                this.init();
            }

            Track.prototype = Object.create({
                init: function() {
                    //this.model = new
                },


            });

            var beatCount = 0,
                patternLength = 16,
                tracks = [
                    new Track([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],  bd),
                    //new Track([0,1,0,1,0,0,0,1,0,0,0,1,0,0,1,0],  hihat),
                    //new Track([0,0,1,0,0,0,1,0,0,0,1,0,0,0.5,0,1],openhh),
                    new Track([0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],snare),
                ];
                
            // Play 1/16 note
            setInterval(function(){
                var track;


                for(var t in tracks) {
                    track = tracks[t];
                    if(track.notes[beatCount] != 0) {
                        swingOffset = (beatCount%2 == 0) ? 0 : (60/tempo)/12;
                        playSound(track, 
                                  context.currentTime+swingOffset, 
                                  track.notes[beatCount]);
                    }
                }
                beatCount++;

                if (beatCount == patternLength) {
                    beatCount = 0;
                }

            }, (60/tempo)/4 * 1000 );

            /*
            navigator.webkitGetUserMedia({audio: true}, function(stream) {
                liveSource = context.createMediaStreamSource(stream);
                liveSource.connect(out);
            });
            */

        } 
    init();
    return;

    }
);
