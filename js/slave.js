define(['util', 'peer', 'socket'], function(util, Peer, Socket) {
    function Slave() {
        this.master = false;
        Peer.call(this);
    }

    Slave.prototype = Object.create(util.extend({}, Peer.prototype, {
        announce: function(){
            Socket.sendMessage({
                type: "announce_slave",
                client_id: this.client_id
            });
        },
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

                // Respond to master with an offer, unless we're already connected
                if (msg.type == 'announce_master' && 
                    (cnxn == null || !cnxn.getStatus())) {
                    /*
                     * The following shouldn't ever be a case since master will 
                     * queue up offers.
                    // May happen when we responded to a last announce but
                    // did not get connected
                    if (cnxn != null && !cnxn.getStatus()) {
                        cnxn.close();
                        this.removeLastConnection();
                    }
                    */

                    cnxn = this.newConnection(msg.client_id, true);

                    this.addConnection(cnxn);
                    
                // An offer from master
                } else if (msg.type === 'offer') {
                    if (cnxn == null) {
                        var cnxn = this.newConnection(msg.client_id, false);
                        cnxn.server_id = this.client_id;
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
        }
    }));

    return Slave;
});
