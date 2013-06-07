/*
 * Maintain a pool of WebRTC connections and their respective data channels.
 * Allows broadcasting messages to data channels of all connected peers, and
 * to connections with specific client ID's.
 *
 * EVENTS
 * * data_channel_state -- a change in the state of the data channel. The 
 * first argument to the callback is an object with 'state' and 'client_id'
 * set to current and connection ID of the parent data channel
 * * data_channel_message -- a new message on a data channel.
 */
define(['util', 'rtc/rtc', 'rtc/socket', 'underscore', 'backbone'], 
       function(util, RTCConnection, Socket, _, Backbone) {
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
        // Handle WebSocket messages
        processMessage: function(message) {
            throw 'Not implemented'
        },

        // Set up WebSocket for RTC handshake
        initSocket: function() {
            var that = this
            if (this.socket) 
                delete this.socket

            this.socket = new WebSocket('ws://'+window.location.hostname+':1337/')
            this.socket.addEventListener(
                'message', 
                 _.bind(this.processMessage, this))

            // Keep trying to re-connect to websocket server if connection closes
            this.socket.addEventListener('close', _.bind(function() {
                    console.log('Peer: WebSocket closed, attempting to reconnect');
                    this.registered = false

                    setTimeout(
                        _.bind(this.initSocket, this), 
                        1500)
                }, this));

            this.socket.addEventListener('open', function() {
                that.register()
                that.announce()
            });
        },

        // Register with the server. The server will return a client_id, 
        // unless we already have one in case of a reconnect
        register: function() {
            this.sendSocketMessage({
                type: "register",
                client_id: this.client_id
            });
        },

        // WebSockets are used to exchange control messages about the session,
        // as well as the WebRTC handshake messages
        sendSocketMessage: function sendMessage(message) {
            var msgString = JSON.stringify(message);
            //console.log("TO WSS:", msgString);
            this.socket.send(msgString);
        },

        // Send message to all current WebRTC connections
        sendToAll: function(msg, except) {
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
        sendTo: function(client_id, msg) {
            console.log('PEERS: Sending msg to client', client_id, msg);
            var cnxn;

            for(var c in this.connections) {
                var cnxn = this.connections[c];

                if (cnxn.client_id == client_id) {
                    cnxn.sendData(JSON.stringify(msg));
                }
            };
        },

        // Create a new RTC connection for given client_id.
        newConnection: function(client_id, local_id, dataChannel) {
            var that = this,
                connection = new RTCConnection(client_id, local_id) .init(
                                this.socket, dataChannel)

            // TODO: Clean up disconnected connections in Master
            // Try to reestablish connection if it dies
            connection.cnxn.addEventListener('iceconnectionstatechange', function(e){
                console.log('PEER: ICE state change:', e, 
                            'connection:', this.iceConnectionState,
                            'gathering:', this.iceGatheringState);

                // The connection has died. Close the data channel.
                if (this.iceConnectionState == 'disconnected') {
                    connection.dataChannel.close();
                    console.log('Peer: ICE disconnect. Removing connection:', connection);
                    setTimeout(function(){
                        that.removeConnection(connection);
                    }, 1000);
                }
            });

            // Handle raw data channel events by passing on data channel
            // state changes and parsing JSON on new channel messages
            connection.on('data_channel_ready', function() {
                console.log('Peer: data channel is ready')
                this.dataChannel.addEventListener('message', 
                    function(message){
                        message.client_id = connection.client_id
                        that.dataChannelMessage(message)
                    })

                this.dataChannel.addEventListener('open', 
                    _.bind(that.dataChannelState, connection))

                this.dataChannel.addEventListener('close', 
                    _.bind(that.dataChannelState, connection))
            })

            if(dataChannel) {
                connection.trigger('data_channel_ready')
            }

            connection.makeOffer()
            return connection;
        },

        // Send welcome connection package. Only Master implements this.
        welcome: function(){},

        // Parse raw data channel message into JSON, then notify
        // all subscribers of new message
        dataChannelMessage: function(msg) {
        // TODO: ignore all messages outside of this session ID
            console.log('Peer: New data channel message')
            var json;
            if(!msg.data) {
                console.error("PEER:Empty data channel message");
                return
            }

            try {
                json = JSON.parse(msg.data);
            } catch(e) {
                console.error("PEER: Couldn't parse JSON for message");
                return
            }

            msg.dataParsed = json;
            this.trigger('data_channel_message', msg);
        },

        // Data channel becomes open or closed. This executes in the context
        // of an RTCConnection to make pulling out client_id easier.
        dataChannelState: function() {
            console.log("Peer: Data channel state change for client_id:",
                       this.client_id)
            this.trigger('data_channel_state', {
                state: this.dataChannel.readyState,
                client_id: this.client_id
            });

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
            cnxn.close();
        },
    }, Backbone.Events));

    return Peer;
});
