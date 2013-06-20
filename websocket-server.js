var WebSocketServer = require('websocket').server;
var http = require('http');
var clients = [],
    // TODO: hash or randomize IDs
    connectionCount = 0, 
    NEW_CLIENT_ID = -1;

var server = http.createServer(function(request, response) {
    // process HTTP request. Since we're writing just WebSockets server
    // we don't have to implement anything.
});
server.listen(1337, function() {
  console.log((new Date()) + " Server is listening on port 1337");
});

wsServer = new WebSocketServer({
    httpServer: server
});

// 1 in 2^^122 chance of collisions.
// http://stackoverflow.com/a/2117523
function genUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

function addToSession(){
}

function errorHandler(err){
    if(err){
        console.log('Connection error. ');
    }
}

function newClientID(){
    connectionCount++
    return connectionCount
}

function echoMessage(sid, message, to) {
    console.log('Sending msg to', to)
    Session.each(sid, function(connection) {
        console.log('Sending msg to', connection.client_id)
        connection.send(message, errorHandler)
    })
}

/*
 * Handle incoming requests.
 */
wsServer.on('request', function(request) {
    var connection = request.accept(null, request.origin);

    console.log(Date(),'New connection from', connection.remoteAddress);
    connection.client_id = NEW_CLIENT_ID

    //clients.push(connection)
    console.log('Total clients:', clients.length)
    
    connection.on('message', function(message) {
        var sendTo = [], 
            sid, client_id, msg

        // Ignore malformed messages
        if (message.type !== 'utf8') return

        try {
            msg = JSON.parse(message.utf8Data);
            console.log('New message')
        } catch(e) {
            console.log("Non-JSON payload from:", this.remoteAddress);
            return;
        }

        sid = msg.session_id
        client_id = msg.client_id

        // Client (re-)registration
        if (msg.type == "register") {
            // Create new session and client ID
            if (client_id <= NEW_CLIENT_ID || isNaN(client_id)) {
                client_id = connectionCount
                connectionCount++
                sid = Session.create()
                msg.session_id = sid
                Session.addConnection(sid, client_id, connection)

                console.log('New session for', client_id)

            // An existing client_id provided
            } else {
                // Check for session validity
                sid = msg.session_id

                if(!sid ||
                  !Session.clientInSession(sid, client_id)) {
                    console.error('Hack: Existing client ID without a valid session ID', 
                                  this.remoteAddress)
                    this.close()
                    return
                }
                
                // The case of server going down and client re-registering with
                // existing client_id
                if (connectionCount < client_id) {
                    connectionCount = client_id;
                    connectionCount++;
                }

            }
            connection.client_id = client_id
            Session.addConnection(sid, client_id, connection)
            // Include current number of clients so peer knows if it's alone
            msg.client_count = Object.keys(Session.get(sid)).length
            sendTo = [client_id]
            
        // Send message to a specific session ID
        // TODO: verify both from and dest are in the right session
        } else if (msg.dest > 0 && msg.from > 0) {
            if(!Session.exists(sid) || !Session.clientInSession(sid, client_id)) {
                console.error("DM with invaid session or client ID", this.remoteAddress)
                return
            }

            sendTo = [msg.dest]
        // Broadcast message to all connected clients
        } else {
            if(!Session.exists(sid) || !Session.clientInSession(sid, client_id)) {
                console.error("Broadcast with invalid session or client ID", this.remoteAddress)
                return
            }

            console.log('Broadcast', msg.type, "from:",
                    connection.client_id);
            
            sendTo = Object.keys(Session.get(sid))
        }

        // sign message with client ID
        msg.client_id = this.client_id;
        echoMessage(sid, JSON.stringify(msg), sendTo);
    })

    connection.on('close', function(connection) {
        clients.splice(clients.indexOf(this), 1);
        console.log("Peer disconnected.", this.client_id);        
    });
});

// SESSIONS ///////////////////

Session = {
    sessions : {},

    create: function(){
        var uuid = genUUID()
        this.sessions[uuid] = {}
        return uuid
    },

    get: function(session_id) {
        return this.sessions[session_id]
    },

    exists: function(session_id) {
        return this.get(session_id) === undefined
    },

    addConnection: function(session_id, client_id, connection) {
        this.sessions[session_id][client_id] = connection
    },

    getConnection: function(sessions_id, client_id) {
        return this.sessions[session_id][client_id]
    },

    clientInSession: function(session_id, client_id) {
        return this.sessions[session_id][client_id] !== undefined
    },

    each: function(session_id, func) {
        var session = this.get(session_id)
        if (!session) 
            return null
        else 
            for(var c in session) {
                func(session[c])
            }
    }

}



// Util ////////////////
var oconsole = console
// Add date stamping to console functions

console = {
    log: function() {
        args = Array.prototype.slice.call(arguments);
        args.unshift(Date()) 
        return oconsole.log.apply(this, args)
    },

    error: function() {
        args = Array.prototype.slice.call(arguments);
        args.unshift(Date()) 
        return oconsole.error.apply(this,args)
    }
}
