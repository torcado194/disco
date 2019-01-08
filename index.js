const Emitter = require('events').EventEmitter;
const WebSocket = require('ws');
const Zlib = require('zlib');

var Disco = {
    VERSION: "0.0.1",
    clients: []
};

Disco.Client = function(token){
    let client = this;
    Disco.clients.push(this);
    Emitter.call(this);
    
    client.guilds = [];
    
    client._token = token;
    client.connecting = true;
    client.ready = false;
    client._socket = new WebSocket(gateway);
    
    client._seq = -1;
    
    client._socket.once('close', hSocketClose);
    client._socket.once('error', hSocketClose);
    client._socket.on('message', hSocketMessage);
    
    function hSocketClose(code, data){
        client.connecting = false;
        client.ready = false;
    }
    
    function hSocketMessage(data, flags){
        let message = serializeSocketMessage(data, flags);
        client.emit('any', message);
        
        switch(message.op){
            case 0: //Dispatch | Receive | dispatches an event
                client._seq = message.s;
                break;
            case: 1 //Heartbeat | Send/Receive | used for ping checking
                send(Disco.Payloads.HEARTBEAT(client));
                break;
            case: 2 //Identify | Send | used for client handshake
                break;
            case: 3 //Status Update | Send | used to update the client status
                break;
            case: 4 //Voice State Update | Send | used to join/move/leave voice channels
                break;
            case: 6 //Resume | Send | used to resume a closed connection
                break;
            case: 7 //Reconnect | Receive | used to tell clients to reconnect to the gateway
                break;
            case: 8 //Request Guild Members | Send | used to request guild members
                break;
            case: 9 //Invalid Session | Receive | used to notify client they have an invalid session id
                break;
            case: 10 //Hello | Receive | sent immediately after connecting, contains heartbeat and server debug information
                break;
            case: 11 //Heartbeat ACK | Receive | sent immediately following a client heartbeat that was received
                break;
        }
    }
    
    function serializeSocketMessage(data, flags){
        flags = flags || {};
        return flags.binary ? JSON.parse(Zlib.inflateSync(data).toString()) : JSON.parse(data);
    }
    
    function send(){
        if(client._socket && client._socket.readyState == 1)
        client._socket.send(JSON.stringify(data));
    }
}


Disco.Payloads = {
    HEARTBEAT: function(client) {
        return {op: 1, d: client.internals.sequence};
    },
}












/*

const ws = new WebSocket('ws://www.host.com/path');

ws.on('open', function open() {
    ws.send('something');
});

ws.on('message', function incoming(data) {
    console.log(data);
});

*/