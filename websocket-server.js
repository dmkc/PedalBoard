var WebSocketServer = require('websocket').server;
var http = require('http');
var clients = [];
connectionCount = 0;

var server = http.createServer(function(request, response) {
    // process HTTP request. Since we're writing just WebSockets server
    // we don't have to implement anything.
});
server.listen(1337, function() {
  console.log((new Date()) + " Server is listening on port 1337");
});

// create the server
wsServer = new WebSocketServer({
    httpServer: server
});

function sendCallback(err) {
    if (err) {
        console.error("send() error: " + err, err);
    }
}

// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');
    var connection = request.accept(null, request.origin);
    console.log(' Connection ' + connection.remoteAddress);
    // XXX: not atomic, duh. Count used for debug.
    connection.id = connectionCount;
    connectionCount++;

    clients.push(connection);
    console.log('clients:', clients.length);
    
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log((new Date()) + ' Received Message from',
                        connection.id, message.utf8Data);
            // Broadcast message to all connected clients
            clients.forEach(function (outputConnection) {
                if (outputConnection != connection) {
                    console.log('Sending msg to', outputConnection.remoteAddress);
                    outputConnection.send(message.utf8Data, function(err){
                        if(err){
                            console.log('Error with connection ', 
                                        outputConnection.id, err);
                        }
                    });
                }
            });

        }
    });


    
    connection.on('close', function(connection) {
        // XXX: Concurrency fail. Thanks async
        clients.splice(clients.indexOf(this), 1);

        // Delete will set key to `undefined` which should solve
        // forEach issues but will make forEach grow
        //delete clients[ clients.indexOf(this) ];
        console.log((new Date()) + " Peer disconnected.", this.id);        
    });
});
