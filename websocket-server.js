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

function errorHandler(err){
    if(err){
        console.log('Connection error. ');
    }
}

function assignClientID(msg, connection) {
    // New client registration
    if (msg.client_id === NEW_CLIENT_ID) {
        connection.client_id = connectionCount;
        connectionCount++;
    } else {
        connection.client_id = msg.client_id;
        // Edge case of server going down and client re-registering with
        // existing client_id
        if (connectionCount < msg.client_id) {
            connectionCount = msg.client_id;
            connectionCount++;
        }
    }
}

function echoMessage(message, to) {
    to.forEach(function (outputConnection) {
        if (outputConnection.client_id < 0) {
            console.error("ERR: Unregistered connection from", 
                        outputConnection.remoteAddress);
        } else {
            console.log('MSG to', outputConnection.remoteAddress);
            outputConnection.send(message, errorHandler);
        }
    });
}

/*
 * Handle incoming requests.
 */
wsServer.on('request', function(request) {
    var connection = request.accept(null, request.origin),
        sendTo = [];

    console.log('New connection from', connection.remoteAddress);
    connection.client_id = NEW_CLIENT_ID;

    clients.push(connection);
    console.log('Total clients:', clients.length);
    
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            try {
                var msg = JSON.parse(message.utf8Data);
            } catch(e) {
                console.log("Ignoring a non-JSON payload:", message);
                return;
            }

            // Client (re-)registration
            if (msg.type == "register") {
                assignClientID(msg, this); 
                sendTo = [this];

            // Broadcast message to all connected clients
            } else {
                console.log((new Date()).toString(), msg.type, "message from:",
                        connection.client_id);
                
                clients.forEach(function (outputConnection) {
                    if (outputConnection != connection) {
                        sendTo.push(outputConnection);
                    }
                });
            }
            // sign message with client ID
            msg.client_id = this.client_id;
            echoMessage(JSON.stringify(msg), sendTo);
        }
    });

    connection.on('close', function(connection) {
        clients.splice(clients.indexOf(this), 1);
        console.log((new Date()) + " Peer disconnected.", this.client_id);        
    });
});
