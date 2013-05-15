define(['util', 'peer', 'socket'], function(util, Peer, Socket) {
    function Master() {
        this.master = true;
        Peer.call(this);
    }

    Master.prototype = Object.create(util.extend({}, Peer.prototype, {
        announce: function(){
            Socket.sendMessage({
                type: "announce_master",
                client_id: this.client_id
            });
        },

        processMessage: function(message) {
            var msg = JSON.parse(message.data),
                cnxn;

            console.log('Received message', msg);
            if (!this.registered) {
                if (msg.type === 'register') {
                    this.client_id = msg.client_id;
                    this.registered = true;

                    console.log("Registered with server, ID:", this.client_id);

                } else {
                    this.register();
                }
                
            } else {
                cnxn = this.findConnection(msg.client_id);

                if (msg.type === 'offer') {
                    if (cnxn == null) {
                        var cnxn = this.newConnection(msg.client_id, false);
                        cnxn.server_id = this.client_id;
                        this.addConnection(cnxn);
                    } 
                    cnxn.respondToOffer(msg);

                // TODO: accept announce_master connections as well for more
                // complex topologies
                } else if (msg.type == 'announce_slave') {
                    var cnxn = this.newConnection(msg.client_id, true);
                    cnxn.server_id = this.client_id;
                    this.addConnection(cnxn);
                    
                } else if (msg.type == 'answer') {
                    console.log("Received answer from a peer");
                    cnxn.answer(msg);

                } else if (msg.type === 'candidate') {
                    cnxn.addCandidate(msg);

                } else if (msg.type === 'bye' && peer.started) {
                    console.log('BYE');
                    cnxn.close();
                } 
            }
        }
    }));

    return Master;
});
