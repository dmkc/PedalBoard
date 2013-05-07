// Magic number for an unregistered client
NEW_CLIENT_ID = -1;

performance.now = performance.now || performance.webkitNow; // hack added by SD!

var media = {};
media.fake = media.audio = true;

var socket;


/* 
 * WebSockets are used to pass control and WebRTC messages
 */
function Socket() {

}

function initSocket() {
    if (socket) {
        socket.close();
        socket = null;
    }

    socket = new WebSocket('ws://'+window.location.hostname+':1337/');

    return socket;
}

function sendMessage(message) {
    var msgString = JSON.stringify(message);
    console.log("TO WSS:", msgString);
    socket.send(msgString);
}



// RTC ///////////

function Peer() {
    var registered = this.registered = false,
        client_id = this.client_id = NEW_CLIENT_ID,
        socket = this.socket,
        connections = this.connections = [],
        master = this.master,
        that = this;

    // TODO: move to constructor
    socket = initSocket();
    socket.addEventListener('message', proxy(this.processMessage, this));

    socket.addEventListener('close',  function() {
        console.log('Socket closed');
        that.registered = false;

        setTimeout(function(){
            console.log("Attempting to reconnect WebSocket...");
            initSocket();
        }, 2000);
    });

    socket.addEventListener('open', function() {
        that.register();
        if (master) {
            that.announce();
        }
    });


}

Peer.prototype = Object.create({
    /*
     * Handle WebSocket messages.
     */
    processMessage: function(message) {
        throw 'Not implemented';
    },

    register: function() {
        sendMessage({
            type: "register",
            client_id: this.client_id
        });
    },

    announce: function(){
        sendMessage({
            type: "announce",
            client_id: this.client_id
        });
    },

    findConnection: function(client_id) {
        for(var c in this.connections) {
            if (this.connections[c].client_id === client_id)
                return this.connections[c];
        }
        return null;
    },

    addConnection: function(connection) {
        this.connections.push(connection);
    },

    sendToAll: function(msg) {
        this.connections.forEach(function(cnxn) {
            cnxn.sendData(msg);
        });
    },
});


function Master() {
    this.master = true;
    Peer.call(this);
}

Master.prototype = Object.create(extend(Peer.prototype, {
    processMessage: function(message) {
        var msg = JSON.parse(message.data),
            peer,
            cnxn;

        if (!this.registered) {
            if (msg.type === 'register') {
                this.client_id = msg.client_id;
                this.registered = true;

                console.log("Registered with server, ID:", this.client_id);

            } else {
                this.register();
            }
            
        } else {
            peer = this.findConnection(msg.client_id);

            if (msg.type === 'offer' && this.master) {
                if (peer == null) {
                    var peer = new RTCConnection(msg.client_id).init(false);
                    this.addConnection(peer);
                    cnxn = peer.cnxn;
                } 
                peer.respondToOffer(msg);

            } else if (msg.type == 'announce' && !this.master) {
                var peer = new RTCConnection(msg.client_id).init(true);
                this.addConnection(peer);
                
            } else if (msg.type == 'offer' && !this.master) {
                // TODO: check pool of connections for client_id
                console.log("New client knocking:", msg.client_id);
                //createConnection();

            } else if (msg.type == 'answer') {
                console.log("Received answer from a peer");
                peer.answer(msg);
                peer.client_id = msg.client_id;

            } else if (msg.type === 'candidate') {
                peer.addCandidate(msg);

            } else if (msg.type === 'bye' && peer.started) {
                console.log('BYE');
                peer.closeConnections();
            } 
        }
    }
}));

function Slave() {
    this.master = false;
    Peer.call(this);
}

Slave.prototype = Object.create(extend(Peer.prototype, {
    processMessage: function(message) {
        var msg = JSON.parse(message.data),
            peer,
            cnxn;

        if (!this.registered) {
            if (msg.type === 'register') {
                this.client_id = msg.client_id;
                this.registered = true;

                console.log("Registered with server, ID:", this.client_id);

            } else {
                this.register();
            }
            
        } else {
            peer = this.findConnection(msg.client_id);

            if (msg.type === 'offer' && this.master) {
                if (peer == null) {
                    var peer = new RTCConnection(msg.client_id).init(false);
                    this.addConnection(peer);
                    cnxn = peer.cnxn;
                } 
                peer.respondToOffer(msg);

            } else if (msg.type == 'announce' && !this.master) {
                var peer = new RTCConnection(msg.client_id).init(true);
                this.addConnection(peer);
                
            } else if (msg.type == 'offer' && !this.master) {
                // TODO: check pool of connections for client_id
                console.log("New client knocking:", msg.client_id);
                //createConnection();

            } else if (msg.type == 'answer') {
                console.log("Received answer from a peer");
                peer.answer(msg);
                peer.client_id = msg.client_id;

            } else if (msg.type === 'candidate') {
                peer.addCandidate(msg);

            } else if (msg.type === 'bye' && peer.started) {
                console.log('BYE');
                peer.closeConnections();
            } 
        }
    }
}));

function RTCConnection(client_id) {
    this.client_id = client_id || NEW_CLIENT_ID;
    this.cnxn
    this.sendChannel
    this.receiveChannel
    this.dataChannel
    this.started = false;
}

RTCConnection.prototype = Object.create({
    init: function(dataChannel) {
        // TODO: handle reconnection  elsewhere
        if(!this.cnxn || this.cnxn.iceConnectionState === 'disconnected') {
            this.closeConnections();
            this.createConnection(dataChannel);
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
                this.dataChannel.onopen = proxy(this.onDataChannelStateChange, this);
                this.dataChannel.onclose = proxy(this.onDataChannelStateChange, this);
                console.log('Created send data channel');
            }
        } catch (e) {
            console.log('Create Data channel failed with exception: ' + e.message);
        }
        cnxn.addEventListener('icecandidate', this.onIceCandidate);
        cnxn.addEventListener('datachannel', 
            proxy(this.newDataChannelCallback, this));

        cnxn.onicechange = function(e){
            // TODO: look for another master
            console.log('ICE state change:', 
                        cnxn.iceConnectionState, 
                        e);
        };

        cnxn.onstatechange = function(e){
            console.log('Connection state change:', 
                cnxn.readyState,
                e);
        };

      
        cnxn.createOffer(proxy(this.setLocalAndSendMessage, this));

        return cnxn;
    },

    respondToOffer : function(msg) {
        // Handle offer/answer handshake
        this.cnxn.setRemoteDescription(new RTCSessionDescription(msg));
        console.log("Sending session answer to PRI");
        this.cnxn.createAnswer(proxy(this.setLocalAndSendMessage, this));
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
        console.log('setlocalandsend', this);
        this.cnxn.setLocalDescription(sessionDescription);
        sendMessage(sessionDescription);
    },


    sendData: function(data) {
      this.dataChannel.send(data);
      console.log('Sent Data: ' + data);
    },

    closeConnections : function() {
      console.log('Closing data Channels');
      if (this.sendChannel) sendChannel.close();
      if (this.receiveChannel) receiveChannel.close();
      if (this.cnxn) this.cnxn.close();
      this.cnxn = null;
      console.log('Closed peer connections');

      this.started = false;
    },

    //
    // CALLBACKS
    //
    onDataChannelStateChange: function() {
        var readyState = this.dataChannel.readyState;
        console.log('Data channel state change: ' + readyState);
        if (readyState == "open") {
            this.dataChannel.onmessage = this.onReceiveMessageCallback;
            //this.dataChannel.onopen = onDataChannelStateChange;
            //this.dataChannel.onclose = onDataChannelStateChange;
        } 
    },


    newDataChannelCallback: function(event) {
      console.log('Receive Channel Callback');
      this.dataChannel = event.channel;
      this.dataChannel.onmessage = proxy(this.onReceiveMessageCallback, this);
      this.dataChannel.onopen = proxy(this.onDataChannelStateChange, this);
      this.dataChannel.onclose = proxy(this.onDataChannelStateChange, this);
    },

    onIceCandidate: function onIceCandidate(event) {
        if (event.candidate) {
            sendMessage({
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


// Run function in given context
function proxy(func, context) {
    return function() {
        func.apply(context, arguments);
    };
}

// Extend object with properties of another
// Borrowed from Underscore.js: https://github.com/documentcloud/underscore
function extend(obj) {
    Array.prototype.forEach.call(
        Array.prototype.slice.call(arguments, 1), 
        function(source) {
            if (source) {
                for (var prop in source) {
                    obj[prop] = source[prop];
                }
            }
    });
    return obj;
};
