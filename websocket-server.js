var WebSocketServer = require('websocket').server;
var http = require('http');
var clients = [],
    connectionCount = 0, 
    NEW_CLIENT_ID = -1;

var server = http.createServer(function(request, response) {});
server.listen(1337, function() {
  console.log("Server listening on port 1337");
});

// Set up WebSocket server
wsServer = new WebSocketServer({
    httpServer: server
});

// 1 in 2^^122 chance of collisions.
// http://stackoverflow.com/a/2117523
function genSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

function errorHandler(err){
    console.error('Connection error: ', err);
}

function newClientID(){
    connectionCount++
    return connectionCount
}

function echoMessage(sid, message, to) {
    Session.each(sid, function(connection) {
        if(to.indexOf(connection.client_id) < 0) return
        console.log('Sending msg to', connection.client_id)
        connection.send(message, errorHandler)
    })
}

wsServer.on('request', function(request) {
    var connection = request.accept(null, request.origin);

    console.log('New connection:', connection.remoteAddress);
    connection.client_id = NEW_CLIENT_ID

    console.log('Total clients:', clients.length)
    
    // Process WebSocket messages
    connection.on('message', function(message) {
        var sendTo = [], 
            sid, client_id, msg

        // Ignore malformed messages
        if (message.type !== 'utf8') {
            console.log('Non-UTF message', this.remoteAddress)
            return
        }

        try {
            msg = JSON.parse(message.utf8Data);
        } catch(e) {
            console.error("Non-JSON payload from:", this.remoteAddress)
            return
        }

        sid = msg.session_id
        client_id = new Number(msg.client_id)

        // Client (re-)registration
        if (msg.type == "register") {
            // Create new session and client ID
            if (client_id <= NEW_CLIENT_ID || isNaN(client_id)) 
            {
                client_id = newClientID()
                sid = Session.create()
                msg.session_id = sid
                Session.addConnection(sid, client_id, connection)

                console.log('New session for', client_id)

            // An existing client_id provided
            } else {
                // Check for session validity
                sid = msg.session_id

                if(!sid ||
                  !Session.exists(sid) ||
                  !Session.clientInSession(sid, client_id)) {
                    console.error('A client ID given without a valid session ID', 
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
            connection.session_id = sid
            Session.addConnection(sid, client_id, connection)
            // Include current number of clients so peer knows if it's alone
            msg.client_count = Object.keys(Session.get(sid)).length
            sendTo = [client_id]
            
        // Send message to a specific session ID
        // TODO: verify both from and dest are in the right session
        } else if (msg.dest > 0 && msg.from > 0) {
            if(!sid || !Session.exists(sid) || !Session.clientInSession(sid, client_id)) {
                console.error("DM with invalid session or client ID", this.remoteAddress)
                return
            }

            sendTo = [msg.dest]

        // Broadcast message to all connected clients
        } else {
            if(!sid || !Session.exists(sid) || !Session.clientInSession(sid, client_id)) {
                console.error("Broadcast with invalid session or client ID", this.remoteAddress, msg)
                return
            }

            console.log('Broadcast', msg.type, "from:",
                    connection.client_id);
            
            // Broadcast to everyone except for ourselves
            sendTo = Object.keys(Session.get(sid))
            sendTo.shift(sendTo.indexOf(client_id, 1))
        }

        // sign message with client ID
        msg.client_id = this.client_id;
        echoMessage(sid, JSON.stringify(msg), sendTo)
    })

    // Client disconnected. Clean up memory.
    connection.on('close', function() {
        console.log("Peer disconnected. ID:", 
                    this.client_id, 
                    this.remoteAddress);        
        var session = Session.get(this.session_id)
        if (!session) return
        delete session[this.client_id]
    });
});

// SESSIONS ///////////////////

Session = {
    sessions : {},

    create: function(){
        var uuid = genSessionId()
        this.sessions[uuid] = {}
        return uuid
    },

    // Get hash of clients in a given session
    get: function(session_id) {
        return this.sessions[session_id]
    },

    exists: function(session_id) {
        return this.get(session_id) !== undefined
    },

    addConnection: function(session_id, client_id, connection) {
        this.sessions[session_id][client_id] = connection
    },

    getConnection: function(sessions_id, client_id) {
        var session = this.get(session_id)
        if (!session) 
            return null
        return session[client_id]
    },

    // Return true if a client ID belongs to a particular session
    clientInSession: function(session_id, client_id) {
        var session = this.get(session_id)
        if (!session) 
            return null

        return session[client_id] !== undefined
    },

    // Execute a function for each connection in a particular session
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
var oconsole = require('console')

// Add date stamping to console functions
var console = {
    log: function() {
        args = Array.prototype.slice.call(arguments);
        args.unshift(Date()) 
        return oconsole.log.apply(oconsole, args)
    },

    error: function() {
        args = Array.prototype.slice.call(arguments);
        args.unshift(Date()) 
        return oconsole.error.apply(oconsole,args)
    }
}
