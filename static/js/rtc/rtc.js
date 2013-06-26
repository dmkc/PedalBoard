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
        init: function(socket, dataChannel) {
            var cnxn

            this.socket = socket
            // TODO: handle reconnection  elsewhere
            if(!this.cnxn || this.cnxn.iceConnectionState === 'disconnected') {
                this.close()
                
                this.cnxn = new webkitRTCPeerConnection(
                    null,
                    {optional: [{RtpDataChannels: true}]}
                );
                cnxn = this.cnxn;

                // This connection is an offer. Create a new data channel
                // Otherwise, a data channel has already been established.
                try {
                    if(dataChannel) {
                        this.dataChannel = this.cnxn.createDataChannel(
                            "channel-"+(Math.random()*1000).toFixed(0),
                            {reliable: false}
                        );
                    }
                } catch (e) {
                    console.error('RTC: Creating data channel failed', e);
                }
                cnxn.addEventListener('icecandidate', 
                    util.proxy(this.onIceCandidate, this));
                cnxn.addEventListener('datachannel', 
                    util.proxy(this.newDataChannelCallback, this));
            }

            return this;
        },

        //
        // WEBRTC HANDSHAKE STUFF
        //
        makeOffer: function() {
            this.cnxn.createOffer(util.proxy(this.setLocalAndSendMessage, this));
        },

        respondToOffer : function(msg) {
            this.cnxn.setRemoteDescription(new RTCSessionDescription(msg));
            this.cnxn.createAnswer(util.proxy(this.setLocalAndSendMessage, this));
        },

        answer : function(msg) {
            this.cnxn.setRemoteDescription(new RTCSessionDescription(msg));
        },

        addCandidate : function(msg) {
            console.log("RTC: Add new ICE candidate");
            var candidate = new RTCIceCandidate({
                sdpMLineIndex:msg.label, 
                candidate:msg.candidate
            });

            this.cnxn.addIceCandidate(candidate);
        },

        setLocalAndSendMessage : function(sessionDescription) {
            this.cnxn.setLocalDescription(sessionDescription);
            this.sendMessage(sessionDescription);
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
            // TODO: should rtc know anything about client_id's?
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
        newDataChannelCallback: function(event) {
            this.dataChannel = event.channel;
            this.trigger('data_channel_ready', this)
        },

        onIceCandidate: function onIceCandidate(event) {
            if (event.candidate) {
                this.sendMessage({
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                });
            } 
        },

    });

    _.extend(RTCConnection.prototype, Backbone.Events)
    return RTCConnection
});
