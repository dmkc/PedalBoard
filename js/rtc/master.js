define(['util', 'rtc/peer', 'rtc/socket'], function(util, Peer, Socket) {
    function Master() {
        this.master = true;
        Peer.call(this);
    }

    Master.prototype = Object.create(util.extend({}, Peer.prototype, {
        // Stupid, but seemingly necessary for some basic security
        master: true,

        announce: function(){
            this.sendSocketMessage({
                type: "announce_master",
                client_id: this.client_id
            });
        },

        processMessage: function(message) {
            var msg = JSON.parse(message.data),
                cnxn;

            if (!this.registered) {
                if (msg.type === 'register') {
                    this.client_id = msg.client_id
                    this.registered = true

                    console.log("Master: register with server ID", this.client_id);

                } else {
                    this.register();
                }
                
            } else {
                cnxn = this.findConnection(msg.client_id);

                if (msg.type === 'offer') {
                    if (cnxn == null) {
                        var cnxn = this.newConnection(msg.client_id, this.client_id, false);
                        this.addConnection(cnxn);
                    } 
                    // Respond to offers even if already established connection
                    cnxn.respondToOffer(msg);
                    console.log('Master: Responding to new offer:', msg);

                // A new slave connected to the swarm
                } else if (msg.type == 'announce_slave') {
                    cnxn = cnxn || this.newConnection(msg.client_id, this.client_id, true)
                    this.addConnection(cnxn);
                    
                //
                } else if (msg.type == 'answer') {
                    console.log("Master: Received answer from a peer");
                    // Configure connection with session info from the response
                    // ICE candidates should now begin to be sent by
                    // the browser
                    cnxn.answer(msg);

                } else if (msg.type === 'candidate') {
                    cnxn.addCandidate(msg);

                } else if (msg.type === 'bye' && peer.started) {
                    console.log('BYE');
                    cnxn.close();
                } 
            }
        },


    }));

    return Master;
});
