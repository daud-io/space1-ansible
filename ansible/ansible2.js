var WebSocket = require('ws'),
    util   = require('util'),
    extend   = require('util')._extend,
    hexdump = require('hexdump-nodejs'),
    EventEmitter = require('events'),

    ServerParser = require('./decoders/server/serverparser'),
    Reader = require('./decoders/reader'),
    WorldUpdate = require('./decoders/server/worldupdate'),
    Leaderboard = require('./decoders/server/leaderboard'),
    YouKilled = require('./decoders/server/youkilled'),
    
    fs = require('fs');

var Ansible2 = function() { }

Ansible2.nextID = 1;

util.inherits(Ansible2, EventEmitter);

Ansible2.Connections = {
    eu: [],
    west: [],
    east: [],
    wonderland: [],
    tourn: []
};

Ansible2.prototype.start = function(options) { 

    setInterval(function() {
        for (var server in Ansible2.Connections)
        {
            var connections = Ansible2.Connections[server];
            var update = [];
            for (var i=0; i<connections.length; i++)
            {
                if (connections[i].readyState == 3)
                    connections[i].shutdown();

                var data = connections[i].data;
                if (data)
                {
                    console.log(data);
                    update.push(data);
                }
            }
            var json = JSON.stringify(update);

            for (var i=0; i<connections.length; i++)
            {
                try {
                    connections[i].send(json);
                } catch (e)
                {
                    console.log(e);
                }
            }
        }
    }, 1000);

    var recordingServer = new WebSocket.Server({
        port: 8019
    });

    var origUpgrade = recordingServer.handleUpgrade;
    recordingServer.handleUpgrade = function(req, socket, head, cb) {
        
        socket.url = req.url; // stashing this for later
        origUpgrade.apply(this, [req, socket, head, cb]);
    };
    
    recordingServer.on('connection', function(connection) {
        try
        {
            var server = connection._socket.url;
            if (server)
            {
                var parts = server.split('/');
                server = parts[parts.length-1];
            }

            console.log('new connection for: ' + server);
            var serverConnections = Ansible2.Connections[server];
            connection.isShutdown = false;
            connection.shutdown = function()
            {
                if (connection.isShutdown)
                    return;
                connection.isShutdown = true;

                try {
                    console.log('disconnected id: ' + connection.id);

                    try
                    {
                        if (connection.fileStream)
                            connection.fileStream.close();
                    }
                    catch (e) {}

                
                    for(var i=0; i<serverConnections.length; i++)
                        if (serverConnections[i].id == connection.id)
                        {
                            serverConnections.splice(i, 1);
                            break;
                        }
                } catch (e) {}
                try { connection.close();} catch (e) {}
            };

            serverConnections.push(connection);
            
            connection.fileStream = 
                fs.createWriteStream(
                    'record/playback/' + (new Date()).toISOString()
                );

            connection.on("error", connection.shutdown);
            connection.on("close", connection.shutdown);

            //util.inherits(connection, EventEmitter);
            connection.nick = false;
            connection.id = Ansible2.nextID;
            Ansible2.nextID = Ansible2.nextID+1;
            connection.spectators = [];

            console.log('ansible2 client connected id:' + connection.id);
            
            var parser = new ServerParser();
            var handshakeBuffer = [];
            connection.handshakeBuffer = handshakeBuffer;

            var firstWorldBuffered = false;

            connection.on('message', function(message) {
                if (!firstWorldBuffered)
                    handshakeBuffer.push(message);

                try {
                    if (connection.spectators)
                    {
                        for (var i=0; i<connection.spectators.length; i++)
                        {
                            try {
                                connection.spectators[i](message.slice(12));
                            }
                            catch (e) {}
                        }
                    }

                    connection.fileStream.write(message);                    

                    var message = parser.parse(message, 12);
                    //console.log(message.type);
                    if (message.type == 'worldupdate')
                    {
                        firstWorldBuffered = true;
                        connection.data = false;
                        
                        if (message.fleets && message.fleets.length > 0)
                        {
                            for (var i=0; i<message.fleets.length; i++)
                            {
                                var fleet = message.fleets[i];
                                if (fleet.isMyFleet)
                                {
                                    var size = 0;
                                    for (var i=0; i<fleet.cells.length; i++)
                                    {
                                        var cell = fleet.cells[i];
                                        if (!cell.isSplitting && !cell.isBullet)
                                            size++;    
                                    }

                                    connection.data = {
                                        nick: fleet.name,
                                        score: fleet.score,
                                        position: fleet.leaderboardPosition,
                                        x: fleet.bcx,
                                        y: fleet.bcy,
                                        idFleet: fleet.id,
                                        idConnection: connection.id,
                                        server: server,
                                        size: size
                                    };

                                    break;
                                }
                            }
                        }
                    }
                }
                catch (e)
                {
                    console.log('exception: ' + e);
                    console.log( e.stack );
                    connection.shutdown();
                }
            });

        }
        catch (e)
        {
            console.log('exception: ' + e);
            console.log( e.stack );
            connection.shutdown();
        }
    });
}

module.exports = Ansible2;
