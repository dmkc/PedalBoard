/*
 * A wrapper around WebRTCConnection that handles the actual RTC handshake.
 *
 * EVENTS
 * data_channel_ready : data channel has been initialized and can be listened
 * to for `open` and `close` events as per spec.
 */
define(['util', 'rtc/socket', 'underscore', 'backbone'],
       function(util, Socket, _, Backbone) {
    NEW_CLIENT_ID = -1;
    /*
     * A peer connection.
     *
     * Basically wrapper around RTCPeerConnection over WebSockets
     */
    function RTCConnection(client_id, local_id) {
        this.client_id = client_id || NEW_CLIENT_ID;
        this.local_id = local_id || NEW_CLIENT_ID
        this.cnxn
        this.dataChannel

    }

    RTCConnection.prototype = Object.create({
        // Init. Will need the socket to exchange offers, answers and ICE candidates
        init: function(socket, dataChannel, session_id) {
            var cnxn;

            this.session_id = session_id;
            this.socket = socket;

            // TODO: handle reconnection elsewhere
            if(!this.cnxn || this.cnxn.iceConnectionState === 'disconnected') {
                // this.close();
                var config = { iceServers: [
                    { urls: "stun:stun.l.google.com:19302" }]
                };

                this.cnxn = new RTCPeerConnection(config);
                cnxn = this.cnxn;

                // This connection is an offer. Create a new data channel
                // Otherwise, a data channel has already been established.
                if (dataChannel) {
                    this.dataChannel = this.cnxn.createDataChannel(
                        'channel-' + (Math.random()*1000).toFixed(0)
                    );

                    // Callback only triggered on peer receiving offer
                    setTimeout(function(){
                        this.dataChannelCallback({
                            channel: this.dataChannel
                        });
                    }.bind(this), 1);

                } else {
                    //
                }

                this.cnxn.ondatachannel = function(event) {
                    console.log('RTC: Data channel created');
                    this.dataChannelCallback(event);
                }.bind(this);

                cnxn.addEventListener(
                    'icecandidate',
                    this.onIceCandidate.bind(this)
                );
            }

            return this;
        },

        //
        // WEBRTC HANDSHAKE STUFF
        //
        makeOffer: function() {
            console.log('RTC: Creating offer');
            this.cnxn.createOffer(
                function(session) {
                    this.cnxn.setLocalDescription(session);
                }.bind(this)
            );
        },

        respondToOffer: function(msg) {
            console.log('RTC: Responding to offer', msg);

            this.cnxn.setRemoteDescription(
                new RTCSessionDescription(msg),
                function setRemoteSuccess() {
                    this.cnxn.createAnswer(
                        function answerSuccess(answer) {
                            console.log(
                                'RTC: Created answer',
                                answer.toJSON()
                            );
                            this.cnxn.setLocalDescription(answer);
                        }.bind(this),

                        function answerError(err) {
                            console.error('RTC: Could not create answer', err);
                        }
                    );
                }.bind(this),
                function setRemoteFail(err){
                    console.error('RTC: Could not set remote descr', err);
                }
            );
        },

        answer: function(msg) {
            console.log('RTC: Received answer', msg);
            this.cnxn.setRemoteDescription(
                new RTCSessionDescription(msg),
                function answerSuccess(){
                    console.log('RTC: Accepted answer');
                },
                function answerError(err){
                    console.error('Could not accept RTC answer', err);
                }
            );
        },

        addCandidate: function(msg) {
            console.log("RTC: Add new ICE candidate");
            var candidate = new RTCIceCandidate(msg);

            this.cnxn.addIceCandidate(
                candidate,
                function iceSuccess(){
                    console.log('RTC: Ice candidate success');
                },
                function iceError(err){
                    console.error('RTC: Ice candidate error', err);
                }
            );
        },

        setLocalAndSendMessage: function(sessionDescription) {
            this.cnxn.setLocalDescription(sessionDescription);
            // Wrap offer in a property or any new properties wont JSONify
            this.sendMessage({
                type: sessionDescription.type,
                offer: sessionDescription
            });
        },


        // Send data via connection's data channel.
        sendData: function(data) {
            this.dataChannel.send(data);
        },

        close: function() {
            console.log('RTC: Closing peer connection', this);
            if (this.dataChannel) {
                this.dataChannel.close();
            }
            if (this.cnxn) this.cnxn.close();
        },

        sendMessage: function(msg) {
            // TODO: Leaky abstraction RTC shouldnt know about client_id
            // and sessions
            msg.client_id = this.local_id
            msg.dest = this.client_id
            msg.session_id = this.session_id
            this.socket.send(JSON.stringify(msg));
        },

        //
        // CALLBACKS
        //
        // A data channel is offered by the other side via ICE. Save a
        // reference.
        dataChannelCallback: function(event) {
            console.log('RTC: Adding new data channel');
            this.dataChannel = event.channel;
            this.trigger('data_channel_ready', this)
        },

        onIceCandidate: function onIceCandidate(event) {
            console.log('RTC: ICE candidate', event.candidate);

            if (event.candidate) {
                // Disable trickling candidates for now
                //
                // this.sendMessage({
                //     'type': 'candidate',
                //     'candidate': event.candidate
                // });
            // Gathered candidates
            } else {
                return this.sendMessage({
                    type: this.cnxn.localDescription.type,
                    offer: this.cnxn.localDescription
                });
            }
        },

    });

    _.extend(RTCConnection.prototype, Backbone.Events)
    return RTCConnection
});
