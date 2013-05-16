define(['util', 'rtc', 'socket', 'underscore'], 
       function(util, RTCConnection, Socket,  _) {
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
            console.log('Socket closed');
            that.registered = false;

            setTimeout(function(){
                socket = null;
                console.log("Attempting to reconnect WebSocket...");
                Socket.initSocket();
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
            Socket.sendMessage({
                type: "register",
                client_id: this.client_id
            });
        },

        sendToAll: function(msg) {
            this.connections.forEach(function(cnxn) {
                cnxn.sendData(JSON.stringify(msg));
            });
        },

        sendTo: function(client_id, msg) {
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

                if (this.iceConnectionState == 'disconnected') {
                    console.log('ICE disconnect. Removing connection:', connection);
                    that.removeConnection(connection);
                }
            });

            connection.ondatachannel = util.proxy(this.dataChannelCallback, this);

            connection.makeOffer();
            return connection;
        },

        // TODO: a nicer way to bubble the event up
        // TODO: ignore all messages outside of this session ID
        dataChannelCallback: function(event) {
            if (this.ondatachannel)
                this.ondatachannel(event);
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

    return Peer;
});
