define(['util', 'rtc', 'socket', 'underscore', 'backbone'], 
       function(util, RTCConnection, Socket,  _, Backbone) {
    // Magic number for an unregistered client
    NEW_CLIENT_ID = -1;

    function Peer() {
        var registered = this.registered = false,
            client_id = this.client_id = NEW_CLIENT_ID,
            socket = this.socket,
            connections = this.connections = [],
            master = this.master,
            that = this;

        // TODO: move to constructor
        socket = Socket.initSocket();
        socket.addEventListener('message', util.proxy(this.processMessage, this));

        socket.addEventListener('close',  function() {
            console.log('Peer: WebSocket closed');
            that.registered = false;

            setTimeout(function(){
                socket = null;
                console.log("Peer: Attempting to reconnect WebSocket");
                socket = Socket.initSocket();
            }, 1500);
        });

        socket.addEventListener('open', function() {
            that.register();
            that.announce();
        });


    }

    Peer.prototype = Object.create(
        _.extend({
        // Handle WebSocket messages
        processMessage: function(message) {
            throw 'Not implemented';
        },

        register: function() {
            Socket.sendMessage({
                type: "register",
                client_id: this.client_id
            });
        },

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


        // Start a new connection making an offer.
        newConnection: function(client_id, dataChannel) {
            var dc = dataChannel || false,
                connection = new RTCConnection(client_id).init({
                           dataChannel: dc
                       }),
                that = this;


            // TODO: Clean up disconnected connections in Master
            connection.cnxn.addEventListener('icechange', function(e){
                console.log('Peer: ICE state change:', e, 
                            'connection:', this.iceConnectionState,
                            'gathering:', this.iceGatheringState);

                if (this.iceConnectionState == 'disconnected') {
                    connection.dataChannel.close();
                    that.dataChannelStateCallback(connection);
                    console.log('Peer: ICE disconnect. Removing connection:', connection);
                    setTimeout(function(){
                        that.removeConnection(connection);
                    }, 1000);
                }
            });

            connection.ondatachannel = util.proxy(this.dataChannelCallback, this);
            connection.dataChannelStateCallback = util.proxy(this.dataChannelStateCallback, this);

            connection.makeOffer();
            return connection;
        },

        // TODO: a nicer way to bubble the event up
        // TODO: ignore all messages outside of this session ID
        dataChannelCallback: function(event) {
            var json;
            if(!event.data) {
                console.error("PEER:Empty data channel message");
                return
            }

            try {
                json = JSON.parse(event.data);
            } catch(e) {
                console.error("PEER: Couldn't parse message JSON");
                return
            }

            event.dataParsed = json;
            this.trigger('datachannel', event);
        },

        dataChannelStateCallback: function(connection) {
            var state = connection.dataChannel.readyState;
            this.trigger('connection_state', {
                state: state,
                client_id: connection.client_id
            });

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
    }, Backbone.Events));

    return Peer;
});
