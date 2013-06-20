/*
 * Maintain a pool of WebRTC connections and their respective data channels.
 * Allows broadcasting messages to data channels of all connected peers, and
 * to connections with specific client ID's. 
 *
 * EVENTS
 * - data_channel_state -- a change in the state of the data channel. The 
 * first argument to the callback is an object with 'state' and 'client_id'
 * set to current and connection ID of the parent data channel
 *
 * - data_channel_message -- a new message on one of the peer data channels.
 */
define(['util', 'rtc/rtc', 'underscore', 'backbone'], 
       function(util, RTCConnection, _, Backbone) {
    // Magic number for an unregistered client
    NEW_CLIENT_ID = -1;

    function Peer() {
        var registered = this.registered = false

        this.client_id = NEW_CLIENT_ID
        this.connections = []
    }

    Peer.prototype = Object.create(
        _.extend({

        init: function(){
            this.initSocket()
            return this;
        },

        parseAndProcess: function(msg) {
            return this.processMessage(JSON.parse(msg.data))
        },

        // Announce self to all other peers after a new WebSocket connection
        announce: function(){
            this.sendSocketMessage({
                type: "announce",
                client_id: this.client_id
            });
        },

        // Process an incoming WebSocket message. This is either a control
        // message related to this session, or a WebRTC handshake message
        processMessage: function(msg) {
            var cnxn = this.findConnection(msg.client_id)

            // Server responding to a register message. Ignore it if we 
            // already have a client_id
            if (!this.registered) {
                if (msg.type === 'register') {
                    this.client_id = msg.client_id
                    this.session_id = msg.session_id
                    this.registered = true

                    console.log("Peer: register with server ID", this.client_id);
                    this.announce()
                    this.trigger('registered', msg)

                } else {
                    this.register();
                }
                
            } else {
                // WebRTC handshake message handling

                if (msg.type === 'offer') {
                    if (cnxn == null) {
                        var cnxn = this.newConnection(msg.client_id, this.client_id, false);
                        cnxn.session_id = this.session_id
                        this.addConnection(cnxn);
                    } 
                    // Respond to offers even if already established connection
                    cnxn.respondToOffer(msg);
                    console.log('Peer: Responding to new offer:', msg);

                // A new peer connected to the swarm. Send it an offer.
                } else if (msg.type == 'announce') {
                    cnxn = cnxn || this.newConnection(msg.client_id, this.client_id, true)
                    cnxn.session_id = this.session_id
                    this.addConnection(cnxn);
                    
                // The other peer responded to our offer. Store its session description.
                // This will also cause the browser to begin sending ICE candidates.
                } else if (msg.type == 'answer') {
                    console.log("Peer: Received answer from a peer");
                    cnxn.answer(msg);

                // A new ICE candidate. Put it in the freezer, ho-ho
                } else if (msg.type === 'candidate') {
                    cnxn.addCandidate(msg);

                // The remote peer closed its connection so clean up
                } else if (msg.type === 'bye') {
                    console.log('Peer: Closed connection to peer')
                    cnxn.close()
                    this.removeConnection(cnxn)
                } 
            }
        },

        // jet connection.  WebSocket is used to exchange 
        // control messages about the session and WebRTC handshake messages
        initSocket: function() {
            var that = this
            // Clean up existing socket if there is one, which will clean
            // up any event handling we've set up so far
            if (this.socket) delete this.socket

            this.socket = new WebSocket('ws://'+window.location.hostname+':1337/')
            this.socket.addEventListener(
                'message', 
                 _.bind(this.parseAndProcess, this))

            // Keep trying to re-connect to WebSocket server if connection closes
            this.socket.addEventListener('close', _.bind(function() {
                    console.log('Peer: WebSocket closed, attempting to reconnect');
                    this.registered = false

                    setTimeout(
                        _.bind(this.initSocket, this), 
                        1500)
                }, this));

            // Register and announce self when a new socket connection
            // is established.
            this.socket.addEventListener('open', function() {
                that.register()
            });
        },

        // Register with the server. The server will return a client_id.
        register: function() {
            this.sendSocketMessage({
                type: "register",
                client_id: this.client_id
            });
        },

        sendSocketMessage: function sendMessage(message) {
            message.session_id = this.session_id
            var msgString = JSON.stringify(message);
            //console.log("TO WSS:", msgString);
            this.socket.send(msgString);
        },

        // Send message to all current WebRTC connections
        sendToAll: function(type, body, except) {
            var msg = {
                type: type,
                body: body
            }
            console.log('PEERS: Sending msg to all peers', msg);

            this.connections.forEach(function(cnxn) {
                if(cnxn.client_id === except) return;
                try {
                    cnxn.sendData(JSON.stringify(msg));
                } catch(e) {
                    console.log("Peer: Couldn't send data to", cnxn);
                }
            });
        },

        // Send message to a connection with given client_id
        sendTo: function(connection, type, body) {
            var msg = {
                type: type,
                body: body
            }
            console.log('PEERS: Sending msg to connection',connection.client_id, msg);

            try {
                connection.sendData(JSON.stringify(msg));
            } catch(e) {
                console.log("Peer: Couldn't send data to:", connection);
            }
        },

        // Create a new RTC connection for given client_id.
        newConnection: function(client_id, local_id, dataChannel) {
            var that = this,
                connection = new RTCConnection(client_id, local_id) .init(
                                this.socket, dataChannel)

            // Clean up the connection if it dies
            connection.cnxn.addEventListener('iceconnectionstatechange', function(e){
                console.log('PEER: ICE state change:', e, 
                            'connection:', this.iceConnectionState,
                            'gathering:', this.iceGatheringState);

                // The connection died. Clean up and close the data channel.
                if (this.iceConnectionState == 'disconnected') {
                    connection.dataChannel.close();
                    console.log('Peer: ICE disconnect. Removing connection:', connection);
                    setTimeout(function(){
                        that.removeConnection(connection);
                    }, 1000);
                }
            });

            // Handle raw data channel events by passing through 
            // state changes and parsing JSON on new channel messages
            connection.on('data_channel_ready', function() {
                console.log('Peer: data channel is ready')
                this.dataChannel.addEventListener('message', 
                    function(message){
                        message.client_id = connection.client_id
                        that.dataChannelMessage(message, connection)
                    })

                this.dataChannel.addEventListener('open', 
                    function(){
                        that.dataChannelState(connection)
                    })

                this.dataChannel.addEventListener('close', 
                    function(){
                        that.dataChannelState(connection)
                    })
            })

            if(dataChannel) {
                connection.trigger('data_channel_ready')
            }

            connection.makeOffer()
            return connection
        },

        shutdown: function(){
            this.sendToAll('bye')
        },

        // 
        // CALLBACKS
        //
        // Parse raw data channel message into JSON, then notify
        // all subscribers of new message
        dataChannelMessage: function(msg, connection) {
        // TODO: ignore all messages outside of this session ID
            console.log('Peer: New data channel message')
            var json;
            if(!msg.data) {
                console.error("PEER: Empty data channel message");
                return
            }

            try {
                json = JSON.parse(msg.data);
            } catch(e) {
                console.error("PEER: Couldn't parse JSON for message");
                return
            }

            msg.dataParsed = json
            msg.dataParsed.client_id = connection.client_id
            if (msg.dataParsed.type == 'bye') {
                this.processMessage(msg.dataParsed)
            } else {
                this.trigger('data_channel_message', msg, connection);
            }
        },

        // Notify subscribers of data channel state change. State will change
        // on a successful new connection, or after a disconnect when cleaned
        // up by the callbacks in `newConnection`
        dataChannelState: function(connection) {
            console.log("Peer: Data channel state change for client_id:",
                       connection.client_id)
            this.trigger('data_channel_state', {
                state: connection.dataChannel.readyState,
                client_id: connection.client_id
            }, connection);

        },

        //
        // CONNECTION LIST 
        //
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
        },
    }, Backbone.Events));

    _.extend(Peer, Backbone.Events)
    return Peer
});
