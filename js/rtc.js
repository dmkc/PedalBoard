define(['util', 'socket'], function(util, Socket) {
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
        this.sendChannel
        this.receiveChannel
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
                    console.log('Created send data channel');
                }
            } catch (e) {
                console.log('Create Data channel failed with exception: ' + e.message);
            }
            cnxn.addEventListener('icecandidate', 
                util.proxy(this.onIceCandidate, this));
            cnxn.addEventListener('datachannel', 
                util.proxy(this.newDataChannelCallback, this));


            cnxn.onstatechange = function(e){
                console.log('Connection state change:', 
                    cnxn.readyState,
                    e);
            };

          

            return cnxn;
        },

        makeOffer: function() {
            this.cnxn.createOffer(util.proxy(this.setLocalAndSendMessage, this));
        },

        respondToOffer : function(msg) {
            // Handle offer/answer handshake
            this.cnxn.setRemoteDescription(new RTCSessionDescription(msg));
            console.log("Sending session answer to PRI");
            this.cnxn.createAnswer(util.proxy(this.setLocalAndSendMessage, this));
        },

        answer : function(msg) {
            this.cnxn.setRemoteDescription(new RTCSessionDescription(msg));
        },

        addCandidate : function(msg) {
            console.log("Adding new ICE candidate");
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
          console.log('Sent Data: ' + data);
        },

        close: function() {
            if (this.dataChannel) {
                console.log('Closing data channel');
                this.dataChannel.close();
                this.dataChannel = null;
            }
            if (this.cnxn) this.cnxn.close();
            this.cnxn = null;
            console.log('Closed peer connection.');

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

            var readyState = this.dataChannel.readyState;
            console.log('Data channel state change: ' + readyState);
            if (readyState == "open") {
                this.dataChannel.onmessage = this.onReceiveMessageCallback;
                //this.dataChannel.onopen = onDataChannelStateChange;
                //this.dataChannel.onclose = onDataChannelStateChange;
            } 
        },


        newDataChannelCallback: function(event) {
          console.log('Creating new data channee');
          this.dataChannel = event.channel;
          this.dataChannel.onmessage = util.proxy(this.onReceiveMessageCallback, this);
          this.dataChannel.onopen = util.proxy(this.onDataChannelStateChange, this);
          this.dataChannel.onclose = util.proxy(this.onDataChannelStateChange, this);
        },

        onIceCandidate: function onIceCandidate(event) {
            if (event.candidate) {
                this.sendMessage({
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                });
            } else {
                console.log("End of candidates.");
            }
        },

        onReceiveMessageCallback: function onReceiveMessageCallback(event) {
            console.log('Received Message:', event.data);
        },
    });

    return RTCConnection;
});
