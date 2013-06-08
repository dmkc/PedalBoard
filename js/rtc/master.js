/*
 * A Master is a type of Peer that can connect to multiple other Peers. This
 * creates a Master-Slaves relationship which helps establish authority on 
 * trustworthiness of data that is being synchronized.
 */
define(['util', 'rtc/peer'], function(util, Peer) {
    function Master() {
        this.master = true;
        Peer.call(this);
    }

    Master.prototype = Object.create(util.extend({}, Peer.prototype, {
        // Stupid, but necessary for some basic security
        master: true,

        // Announce self to all other peers after a new WebSocket connection
        announce: function(){
            this.sendSocketMessage({
                type: "announce_master",
                client_id: this.client_id
            });
        },

        // Process an incoming WebSocket message. This is either a control
        // message related to this session, or a WebRTC handshake message
        processMessage: function(message) {
            var msg = JSON.parse(message.data),
                cnxn;

            // Server responding to a register message. Ignore it if we 
            // already have a client_id
            if (!this.registered) {
                if (msg.type === 'register') {
                    this.client_id = msg.client_id
                    this.registered = true

                    console.log("Master: register with server ID", this.client_id);

                } else {
                    this.register();
                }
                
            } else {
                // WebRTC handshake message handling
                cnxn = this.findConnection(msg.client_id);

                // A slave is offering to set up a new connection. Respond.
                if (msg.type === 'offer') {
                    if (cnxn == null) {
                        var cnxn = this.newConnection(msg.client_id, this.client_id, false);
                        this.addConnection(cnxn);
                    } 
                    // Respond to offers even if already established connection
                    cnxn.respondToOffer(msg);
                    console.log('Master: Responding to new offer:', msg);

                // A new slave connected to the swarm. Send it an offer.
                } else if (msg.type == 'announce_slave') {
                    cnxn = cnxn || this.newConnection(msg.client_id, this.client_id, true)
                    this.addConnection(cnxn);
                    
                // The other peer responded to our offer. Store its session description.
                // This will also cause the browser to begin sending ICE candidates.
                } else if (msg.type == 'answer') {
                    console.log("Master: Received answer from a peer");
                    cnxn.answer(msg);

                // A new ICE candidate. Put it in the freezer, ho-ho
                } else if (msg.type === 'candidate') {
                    cnxn.addCandidate(msg);

                // The remote peer closed its connection so clean up
                } else if (msg.type === 'bye' && peer.started) {
                    console.log('Master: Closed connection to peer');
                    cnxn.close();
                } 
            }
        },


    }));

    return Master;
});
