define(['util', 'rtc/peer', 'rtc/socket'], function(util, Peer, Socket) {
    function Slave() {
        this.master = false;
        Peer.call(this);
    }

    Slave.prototype = Object.create(util.extend({}, Peer.prototype, {
        announce: function(){
            this.sendSocketMessage({
                type: "announce_slave",
                client_id: this.client_id
            });
        },

        // Figure 
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
                    
                // An offer from master
                } else if (msg.type === 'offer') {
                    if (cnxn == null) {
                        var cnxn = this.newConnection(msg.client_id, false);
                        cnxn.on('data_channel_state', _.bind(this.dataChannelStateChange, this))
                        cnxn.local_id = this.client_id;
                        this.addConnection(cnxn);
                    } 

                    cnxn.respondToOffer(msg);
                } else if (msg.type == 'answer' && cnxn != null) {
                    console.log("Slave: answer from a peer");
                    cnxn.answer(msg);
                    cnxn.client_id = msg.client_id;

                } else if (msg.type === 'candidate' && cnxn != null) {
                    cnxn.addCandidate(msg);

                } else if (msg.type === 'bye' && cnxn != null) {
                    console.log('BYE');
                    cnxn.close();
                } 
            }
        },

        // Announce self if data channel dies in hopes that master returned
        dataChannelStateChange: function(e) {
            if (e.state == 'closed') {
                this.announce()
            }
        },
    }));

    return Slave;
});
