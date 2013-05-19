define(
    ['buffer-loader'], 
    function(BufferLoader) {
        var context;
        var bufferLoader,
            gainNode;

        function init() {
            // Fix up prefixing
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            context = new AudioContext();
            window.context = context;
            out = context.createDynamicsCompressor();
            window.out = out;
            out.threshold.value = -40;
            out.ratio.value = 30;
            out.knee.value = 30;
            out.connect(context.destination);

            bufferLoader = new BufferLoader(
                context,
                [
                    '/samples/tr707/Bdrum1.wav',
                    '/samples/tr707/Ride4.wav',
                    '/samples/tr707/Hhclose1.wav',
                    '/samples/tr707/Snare1.wav',
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

            function playSound(buffer, time) {
                var source = context.createBufferSource();
                source.buffer = buffer;
                source.connect(out);
                if (!source.start) source.start = source.noteOn;
                source.start(time);
            }

            var bd = bufferList[0],
                ride = bufferList[1],
                hihat = bufferList[2],
                openhh = bufferList[4],
                snare = bufferList[3],
                rimshot = bufferList[3];
            var tempo = 120;

            openhh.gain = 0.5;

            /*
            var snare = BUFFERS.snare;
            var hihat = BUFFERS.hihat;
            */

            function playOneBar() {
                var startTime = context.currentTime;
                var eighthNoteTime = (60 / tempo) / 2,
                    swingOffset = 0;


                for (var bar = 0; bar < 2; bar++) {
                    var time = startTime + bar * 8 * eighthNoteTime;

                    // bass drum
                    for (var i = 0; i < 4; ++i) {
                        playSound(bd, time + i * 2 * eighthNoteTime);
                    }

                    for (var i = 0; i < 2; ++i) {
                        playSound(snare, time + 2*eighthNoteTime + i * 4 * eighthNoteTime);
                    }
                    /*
                    playSound(snare, time + 2 * eighthNoteTime);
                    playSound(snare, time + 6 * eighthNoteTime);
                    */
                    for (var i = 0; i < 16; ++i) {
                        if(i==5 || i==14) continue;
                        swingOffset = (i%2 == 0) ? 0 : eighthNoteTime/6;
                        playSound(hihat, time + i * eighthNoteTime/2+swingOffset);
                    }
                }
            }

            playOneBar();
            setTimeout(function(){
                setInterval(playOneBar, (60/tempo)*8*1000);
            }, (60/tempo)*1000);

        } 
    init();
    return;

    }
);
