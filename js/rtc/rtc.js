define(['util', 'rtc/socket'], function(util, Socket) {
    NEW_CLIENT_ID = -1;
    /*
     * A peer connection.
     *
     * Basically wrapper around RTCPeerConnection over WebSockets
     */
    function RTCConnection(client_id) {
        this.client_id = client_id || NEW_CLIENT_ID;
        this.server_id = NEW_CLIENT_ID;
        this.cnxn
        this.dataChannel
        this.started = false;
    }

    RTCConnection.prototype = Object.create({
        init: function(opts) {
            // TODO: handle reconnection  elsewhere
            if(!this.cnxn || this.cnxn.iceConnectionState === 'disconnected') {
                this.close();
                this.createConnection(opts.dataChannel);
            }

            return this;
        },

        createConnection : function(dataChannel) {
            var servers = null,
                cnxn;
            
            this.started = true;
            this.cnxn = new webkitRTCPeerConnection(
                servers,
                {optional: [{RtpDataChannels: true}]}
            );
            cnxn = this.cnxn;

            try {
                if(dataChannel) {
                    this.dataChannel = this.cnxn.createDataChannel(
                        "channel-"+(Math.random()*1000).toFixed(0),
                        {reliable: false}
                    );
                    this.dataChannel.onopen = util.proxy(this.onDataChannelStateChange, this);
                    this.dataChannel.onclose = util.proxy(this.onDataChannelStateChange, this);
                }
            } catch (e) {
                console.error('RTC: Creating data channel failed', e);
            }
            cnxn.addEventListener('icecandidate', 
                util.proxy(this.onIceCandidate, this));
            cnxn.addEventListener('datachannel', 
                util.proxy(this.newDataChannelCallback, this));

            return cnxn;
        },

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


        sendData: function(data) {
          this.dataChannel.send(data);
        },

        close: function() {
            console.log('RTC: Closing peer connection', this);
            if (this.dataChannel) {
                this.dataChannel.close();
                this.dataChannel = null;
            }
            if (this.cnxn) this.cnxn.close();
            this.cnxn = null;

            this.started = false;
        },

        getStatus: function() {
            return (this.cnxn.iceGatheringState == 'complete' &&
                    this.cnxn.iceConnectionState == 'connected');
        },

        sendMessage: function(msg) {
            // TODO: rtc shouldn't know anything about client_id's
            msg.from = this.server_id;
            msg.dest = this.client_id; 
            Socket.sendMessage(msg);
        },

        //
        // CALLBACKS
        //
        onDataChannelStateChange: function() {
            if (!this.dataChannel) return;

            var readyState = this.dataChannel.readyState,
                dataChannel = this.dataChannel;

            console.log('RTC: Data channel state change', readyState);
            if (readyState == "open") {
                this.dataChannel.onmessage = util.proxy(function(e){ 
                        e.client_id = this.client_id;
                        this.onReceiveMessageCallback(e);
                    }, 
                    this
                );
            } 

            this.dataChannelStateCallback(this);
        },


        newDataChannelCallback: function(event) {
          console.log('RTC: Created new data channel.');
          this.dataChannel = event.channel;
          this.dataChannel.onmessage = util.proxy(this.onReceiveMessageCallback, this);
          this.dataChannel.addEventListener('open', util.proxy(this.onDataChannelStateChange, this));
          this.dataChannel.addEventListener('close', util.proxy(this.onDataChannelStateChange, this));
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

        onReceiveMessageCallback: function onReceiveMessageCallback(event) {
            if(this.ondatachannel) {
                this.ondatachannel(event);
            }
        },
    });

    return RTCConnection;
});
