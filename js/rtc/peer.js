/*
 * Maintain a pool of WebRTC connections and their respective data channels.
 * Allows broadcasting messages to data channels of all connected peers, and
 * to connections with specific client ID's. Extended by Master and Slave
 * prototypes.
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

        this.initSocket()
    }

    Peer.prototype = Object.create(
        _.extend({

        parseAndProcess: function(msg) {
            return this.processMessage(JSON.parse(msg.data))
        },

        // Initialize WebSocket connection.  WebSocket is used to exchange 
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
        // See Master and Slave's `processMessage`
        register: function() {
            this.sendSocketMessage({
                type: "register",
                client_id: this.client_id
            });
        },

        sendSocketMessage: function sendMessage(message) {
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

    return Peer;
});
