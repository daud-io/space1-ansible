var WebSocket = require('ws'),
    util   = require('util'),
    extend   = require('util')._extend,
    hexdump = require('hexdump-nodejs'),
    fs = require('fs'),
    EventEmitter = require('events').EventEmitter,
    Reader = require('./decoders/reader'),
    Ansible2 = require('./ansible2'),
    VariableHeader = require('./decoders/variableheader');

var SpectateServer = function() { }

util.inherits(SpectateServer, EventEmitter);


SpectateServer.prototype.start = function(options) { 
    var config = {
        maestroPort: 8016
    };
    extend(config, options);

    var spectateServer = new WebSocket.Server({
        port: config.maestroPort
    });

    var origUpgrade = spectateServer.handleUpgrade;
    spectateServer.handleUpgrade = function(req, socket, head, cb) {
        
        socket.url = req.url; // stashing this for later
        origUpgrade.apply(this, [req, socket, head, cb]);
    };

    spectateServer.on('connection', function(clientConnection) {
        var connectionID = clientConnection._socket.url.substring('/spectate/'.length);
        console.log('spectate for ' + connectionID);
        
        var targetConnection = false;
        
        for(var server in Ansible2.Connections)
        {
            if (Ansible2.Connections.hasOwnProperty(server))
            {
                var set = Ansible2.Connections[server];
                if (set)
                    for(var i=0; i<set.length; i++)
                    {
                        if (set[i].data
                            && set[i].data.idConnection == connectionID)
                        {
                            targetConnection = set[i];
                            break;
                        }
                    }
            }
        }


        if (targetConnection)        
        {
            console.log('found session');
            console.log(targetConnection.data);
            
            var i = 0;
            setTimeout(function() {
                var int = setInterval(function() {
                    if (i < targetConnection.handshakeBuffer.length)
                    {
                        console.log('handshake packet: ' + i);
                        clientConnection.send(targetConnection.handshakeBuffer[i].slice(12));
                        i++;
                    }
                    else
                    {
                        clientConnection.send(SpectateServer.EmptyWorld);

                        targetConnection.spectators.push(function(message){
                            clientConnection.send(message);
                        });
                        clearInterval(int);
                    }
        
                }, 10);
            }, 2000);
                
        }
        else
        {
            console.log('could not find session');
        }

        var sendSmallPacket = function(connection, bytes)
        {
            connection.send(new Buffer(bytes));
        }
                
        clientConnection.on('message', function incoming(message) {
            //console.log('message from spectate client');

            try {
                var reader = new Reader(message);
                var header = new VariableHeader(reader, true);
                if (header.messageType == 0x21)
                {
                    console.log('sync pong');
                    sendSmallPacket(clientConnection,
                        [0x08, 0x01, 0x12, 0x06, 0xC2, 0x01,
                            0x03, 0x0A, 0x01, 0x60]);
                }

            }
            catch (e)
            {
                console.log('exception: ' + e);
                console.log( e.stack );
                console.log('offending packet');
                console.log(hexdump(message));
            }
        });
    });
}
SpectateServer.EmptyWorld = 
    [0x08, 0x01, 0x12, 0xBC, 0x02, 0xC2, 0x01, 0xB8, 0x02, 0x0A, 0xB5, 0x02, 0x10, 0x01, 0x25, 0xC3,
        0x50, 0xC4, 0x3C, 0x3A, 0x24, 0x45, 0x50, 0x32, 0x20, 0x2D, 0x20, 0x31, 0x2E, 0x33, 0x31, 0x00,
        0x01, 0x00, 0x75, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0x3F, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x4B, 0x28, 0x45, 0x00, 0x77, 0xFD, 0xFF, 0xFF, 0x3B,
        0xFE, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x0A, 0x00, 0x01, 0x00, 0x8B, 0x2C, 0x45, 0x00, 0xB4, 0xFE, 0xFF, 0xFF,
        0x56, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x00, 0x01, 0x00, 0xC4, 0x2D, 0x45, 0x00, 0x9F, 0xFE, 0xFF,
        0xFF, 0xDE, 0xFD, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x00, 0x01, 0x00, 0x00, 0x4E, 0x45, 0x00, 0x50, 0xFC,
        0xFF, 0xFF, 0x1B, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x00, 0x01, 0x00, 0x10, 0x52, 0x45, 0x00, 0x9E,
        0x03, 0x00, 0x00, 0x3B, 0xFE, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x00, 0x01, 0x00, 0xDB, 0x55, 0x45, 0x00,
        0x87, 0xFF, 0xFF, 0xFF, 0xCD, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x00, 0x01, 0x00, 0xA9, 0x56, 0x45,
        0x00, 0x78, 0x02, 0x00, 0x00, 0x43, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x00, 0x01, 0x00, 0x76, 0x58,
        0x45, 0x00, 0x56, 0xFF, 0xFF, 0xFF, 0xD3, 0xFE, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x00, 0x01, 0x00, 0x00,
        0x00];
        
module.exports = SpectateServer;