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
        that.announce();
    });


}

Peer.prototype = Object.create({
    // Handle WebSocket messages
    processMessage: function(message) {
        throw 'Not implemented';
    },

    register: function() {
        sendMessage({
            type: "register",
            client_id: this.client_id
        });
    },

    sendToAll: function(msg) {
        this.connections.forEach(function(cnxn) {
            cnxn.sendData(msg);
        });
    },


    // Start a new connection making an offer.
    newConnection: function(client_id, dataChannel) {
        var dc = dataChannel || false,
            connection = new RTCConnection(client_id).init({
                       dataChannel: dc
                   }),
            that = this;


        // TODO: Clean up disconnected connections in Master
        connection.cnxn.addEventListener('icechange', function(e){
            console.log('ICE state change:', connection.cnxn.iceConnectionState, e);

            if (this.iceGatheringState  != 'complete' ||
                this.iceConnectionState != 'connected') {
                //that.removeConnection(connection);
            }
        });

        connection.makeOffer();
        return connection;
    },

    // Connection list 
    addConnection: function(connection) {
        this.connections.push(connection);
    },

    findConnection: function(client_id) {
        for(var c in this.connections) {
            if (this.connections[c].client_id === client_id)
                return this.connections[c];
        }
        return null;
    },

    lastConnection: function() {
        return (this.connections.length === 0)
            ? null
            : this.connections[this.connections.length - 1];
    },

    removeLastConnection: function() {
        this.connections.pop();
    },

    removeConnection: function(cnxn) {
        this.connections.splice(this.connections.indexOf(cnxn), 1);
        cnxn.close();
    },
});


function Master() {
    this.master = true;
    Peer.call(this);
}

Master.prototype = Object.create(extend({}, Peer.prototype, {
    announce: function(){
        sendMessage({
            type: "announce_master",
            client_id: this.client_id
        });
    },

    processMessage: function(message) {
        var msg = JSON.parse(message.data),
            cnxn;

        console.log('Received message', msg);
        if (!this.registered) {
            if (msg.type === 'register') {
                this.client_id = msg.client_id;
                this.registered = true;

                console.log("Registered with server, ID:", this.client_id);

            } else {
                this.register();
            }
            
        } else {
            cnxn = this.findConnection(msg.client_id);

            if (msg.type === 'offer') {
                if (cnxn == null) {
                    var cnxn = this.newConnection(msg.client_id, false);
                    cnxn.server_id = this.client_id;
                    this.addConnection(cnxn);
                } 
                cnxn.respondToOffer(msg);

            } else if (msg.type == 'announce_slave') {
                var cnxn = this.newConnection(msg.client_id, true);
                cnxn.server_id = this.client_id;
                this.addConnection(cnxn);
                
            } else if (msg.type == 'answer') {
                console.log("Received answer from a peer");
                cnxn.answer(msg);

            } else if (msg.type === 'candidate') {
                cnxn.addCandidate(msg);

            } else if (msg.type === 'bye' && peer.started) {
                console.log('BYE');
                cnxn.close();
            } 
        }
    }
}));

function Slave() {
    this.master = false;
    Peer.call(this);
}

Slave.prototype = Object.create(extend({}, Peer.prototype, {
    announce: function(){
        sendMessage({
            type: "announce_slave",
            client_id: this.client_id
        });
    },
    processMessage: function(message) {
        var msg = JSON.parse(message.data),
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
            cnxn = this.lastConnection();

            // Respond to master with an offer, unless we're already connected
            if (msg.type == 'announce_master' && 
                (cnxn == null || !cnxn.getStatus())) {
                /*
                 * The following shouldn't ever be a case since master will 
                 * queue up offers.
                // May happen when we responded to a last announce but
                // did not get connected
                if (cnxn != null && !cnxn.getStatus()) {
                    cnxn.close();
                    this.removeLastConnection();
                }
                */

                cnxn = this.newConnection(msg.client_id, true);

                this.addConnection(cnxn);
                
            // An offer from master
            } else if (msg.type === 'offer') {
                if (cnxn == null) {
                    var cnxn = this.newConnection(msg.client_id, false);
                    cnxn.server_id = this.client_id;
                    this.addConnection(cnxn);
                } 

                cnxn.respondToOffer(msg);
            } else if (msg.type == 'answer' && cnxn != null) {
                console.log("Received answer from a peer");
                cnxn.answer(msg);
                cnxn.client_id = msg.client_id;

            } else if (msg.type === 'candidate' && cnxn != null) {
                cnxn.addCandidate(msg);

            } else if (msg.type === 'bye' && cnxn != null) {
                console.log('BYE');
                cnxn.close();
            } 
        }
    }
}));

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
                this.dataChannel.onopen = proxy(this.onDataChannelStateChange, this);
                this.dataChannel.onclose = proxy(this.onDataChannelStateChange, this);
                console.log('Created send data channel');
            }
        } catch (e) {
            console.log('Create Data channel failed with exception: ' + e.message);
        }
        cnxn.addEventListener('icecandidate', 
            proxy(this.onIceCandidate, this));
        cnxn.addEventListener('datachannel', 
            proxy(this.newDataChannelCallback, this));


        cnxn.onstatechange = function(e){
            console.log('Connection state change:', 
                cnxn.readyState,
                e);
        };

      

        return cnxn;
    },

    makeOffer: function() {
        this.cnxn.createOffer(proxy(this.setLocalAndSendMessage, this));
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
        msg.from = this.server_id;
        msg.dest = this.client_id; 
        sendMessage(msg);
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
      console.log('Creating new data channee');
      this.dataChannel = event.channel;
      this.dataChannel.onmessage = proxy(this.onReceiveMessageCallback, this);
      this.dataChannel.onopen = proxy(this.onDataChannelStateChange, this);
      this.dataChannel.onclose = proxy(this.onDataChannelStateChange, this);
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
