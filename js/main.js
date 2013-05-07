// Magic word designating the primary node
NEW_CLIENT_ID = -1;

performance.now = performance.now || performance.webkitNow; // hack added by SD!

var media = {};
media.fake = media.audio = true;

var socket;



/* 
 * WebSockets are used to pass control and WebRTC messages
 */
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
    console.log('MSG TO SERVER: ' + msgString);
    socket.send(msgString);
}



// RTC ///////////

function Peer(isMaster) {
    var registered,
        client_id = NEW_CLIENT_ID,
        socket,
        connections = [],
        master = isMaster || false;

    this.connections = connections;

    // TODO: move to constructor
    socket = initSocket();
    socket.addEventListener('message', processMessage);

    socket.addEventListener('close',  function() {
        console.log('Socket closed');
        registered = false;

        setTimeout(function(){
            console.log("Attempting to reconnect WebSocket...");
            initSocket();
        }, 2000);
    });

    socket.addEventListener('open', function() {
        register();
        if (master) {
            announce();
        }
    });

    function register() {
        sendMessage({
            type: "register",
            client_id: client_id
        });
    }

    function announce(){
        sendMessage({
            type: "announce",
            client_id: client_id
        });
    }

    /*
     * Handle WebSocket messages.
     */
    function processMessage(message) {
        var msg = JSON.parse(message.data),
            peer,
            cnxn;

        if (!registered) {
            if (msg.type === 'register') {
                client_id = msg.client_id;
                registered = true;

                console.log("Registered with server, ID:", client_id);

            } else {
                register();
            }
            
        } else {
            peer = findConnection(msg.client_id);

            if (msg.type === 'offer' && master) {
                if (peer == null) {
                    var peer = new PeerConnection(msg.client_id).init(false);
                    addConnection(peer);
                    cnxn = peer.cnxn;
                } 
                peer.respondToOffer(msg);

            } else if (msg.type == 'announce' && !master) {
                var peer = new PeerConnection(msg.client_id).init(true);
                addConnection(peer);
                
            } else if (msg.type == 'offer' && !master) {
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



    function findConnection(client_id) {
        for(var c in connections) {
            if (connections[c].client_id === client_id)
                return connections[c];
        }
        return null;
    }

    function addConnection(connection) {
        connections.push(connection);
    }

}

Peer.prototype.sendToAll = function(msg) {
    this.connections.forEach(function(cnxn) {
        cnxn.sendData(msg);
    });
}


function PeerConnection(client_id) {
    this.client_id = client_id || NEW_CLIENT_ID;
    this.cnxn
    this.sendChannel
    this.receiveChannel
    this.dataChannel
    this.started = false;
}

PeerConnection.prototype.init = function(dataChannel) {
    // TODO: handle reconnection  elsewhere
    if(!this.cnxn || this.cnxn.iceConnectionState === 'disconnected') {
        this.closeConnections();
        this.createConnection(dataChannel);
    }

    return this;
}

PeerConnection.prototype.createConnection = function(dataChannel) {
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
            trace('Created send data channel');
        }
    } catch (e) {
        trace('Create Data channel failed with exception: ' + e.message);
    }
    cnxn.addEventListener('icecandidate', onIceCandidate);
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
}

PeerConnection.prototype.respondToOffer = function(msg) {
    // Handle offer/answer handshake
    this.cnxn.setRemoteDescription(new RTCSessionDescription(msg));
    console.log("Sending session answer to PRI");
    this.cnxn.createAnswer(proxy(this.setLocalAndSendMessage, this));
}

PeerConnection.prototype.answer = function(msg) {
    this.cnxn.setRemoteDescription(new RTCSessionDescription(msg));
}

PeerConnection.prototype.addCandidate = function(msg) {
    console.log("Adding new ICE candidate");
    var candidate = new RTCIceCandidate({
        sdpMLineIndex:msg.label, 
        candidate:msg.candidate
    });

    this.cnxn.addIceCandidate(candidate);
}

PeerConnection.prototype.setLocalAndSendMessage = function(sessionDescription) {
    console.log('setlocalandsend', this);
    this.cnxn.setLocalDescription(sessionDescription);
    sendMessage(sessionDescription);
}


PeerConnection.prototype.sendData = function() {
  var data = document.getElementById("dataChannelSend").value;
  this.dataChannel.send(data);
  trace('Sent Data: ' + data);
}

PeerConnection.prototype.closeConnections = function() {
  trace('Closing data Channels');
  if (this.sendChannel) sendChannel.close();
  if (this.receiveChannel) receiveChannel.close();
  if (this.cnxn) this.cnxn.close();
  //pc2.close();
  this.cnxn = null;
  //pc2 = null;
  trace('Closed peer connections');
  // UI stuff
  dataChannelSend.value = "";
  dataChannelReceive.value = "";
  dataChannelSend.placeholder = "Press Start, enter some text, then press Send.";
  this.started = false;
}

PeerConnection.prototype.onDataChannelStateChange = function() {
    var readyState = this.dataChannel.readyState;
    trace('Data channel state change: ' + readyState);
    if (readyState == "open") {
        this.dataChannel.onmessage = onReceiveMessageCallback;
        //this.dataChannel.onopen = onDataChannelStateChange;
        //this.dataChannel.onclose = onDataChannelStateChange;
    } 
}


PeerConnection.prototype.newDataChannelCallback = function(event) {
  trace('Receive Channel Callback');
  this.dataChannel = event.channel;
  this.dataChannel.onmessage = onReceiveMessageCallback;
  this.dataChannel.onopen = proxy(this.onDataChannelStateChange, this);
  this.dataChannel.onclose = proxy(this.onDataChannelStateChange, this);
}


// TODO: callback mess
function onIceCandidate(event) {
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
}


function onReceiveMessageCallback(event) {
  trace('Received Message:', event.data);
  document.getElementById("dataChannelReceive").value = event.data;
}



function trace(text) {
  // This function is used for logging.
  if (text[text.length - 1] == '\n') {
    text = text.substring(0, text.length - 1);
  }
  console.log((performance.now() / 1000).toFixed(3) + ": " + text);
}


// Run function in given context
function proxy(func, context) {
    return function() {
        func.apply(context, arguments);
    };
}

