/*
 * A Slave can connect to only one other peer, its Master.
 */
define(['util', 'rtc/peer'], function(util, Peer) {
    function Slave() {
        this.master = false;
        Peer.call(this);
    }

    Slave.prototype = Object.create(util.extend({}, Peer.prototype, {
        // Announce self to all peers. Also called when the connection to a
        // master has closed.
        announce: function(){
            this.sendSocketMessage({
                type: "announce_slave",
                client_id: this.client_id
            });
        },

        // Process an incoming WebSocket message. This is either a control
        // message related to this session, or a WebRTC handshake message
        processMessage: function(message) {
            var msg = JSON.parse(message.data),
                cnxn;

            if (!this.registered) {
                if (msg.type === 'register') {
                    this.client_id = msg.client_id;
                    this.registered = true;

                    console.log("Slave: registered with server ID", this.client_id);

                } else {
                    this.register();
                }
                
            } else {
                cnxn = this.lastConnection();

                // Master is announcing self. Respond with an offer
                if (msg.type == 'announce_master' && cnxn == null) {
                    cnxn = this.newConnection(msg.client_id, true);
                    cnxn.on('data_channel_state', _.bind(this.dataChannelStateChange, this))

                    this.addConnection(cnxn);
                    
                // An offer from the master. Set up a new connection
                } else if (msg.type === 'offer') {
                    if (cnxn == null) {
                        var cnxn = this.newConnection(msg.client_id, false);
                        cnxn.on('data_channel_state', _.bind(this.dataChannelStateChange, this))
                        cnxn.local_id = this.client_id;
                        this.addConnection(cnxn);
                    } 

                    cnxn.respondToOffer(msg);

                // Master has responded to our offer (after we responded to
                // an `announce_master` message). Save their session info
                // and begin sending ICE candidates
                } else if (msg.type == 'answer' && cnxn != null) {
                    console.log("Slave: answer from a peer");
                    cnxn.answer(msg);
                    cnxn.client_id = msg.client_id;

                // A new ICE candidate
                } else if (msg.type === 'candidate' && cnxn != null) {
                    cnxn.addCandidate(msg);

                } else if (msg.type === 'bye' && cnxn != null) {
                    console.log('Slave: Master requested to close connection');
                    cnxn.close();
                } 
            }
        },

        // Announce self if data channel dies in the last hope that a master is
        // listening on the WebSocket
        dataChannelStateChange: function(e) {
            if (e.state == 'closed') {
                this.announce()
            }
        },
    }));

    return Slave;
});
