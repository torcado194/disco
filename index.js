const Emitter   = require('events').EventEmitter;
const util      = require('util');
const WebSocket = require('ws');
const Zlib      = require('zlib');
const request   = require('request');
const UDP       = require('dgram');
const DNS       = require('dns');

var Disco = {
    VERSION: "0.0.1",
    GATEWAY_VERSION: 6,
    clients: []
};

Disco.Client = function(token){
    let client = this;
    Emitter.call(this);
    Disco.clients.push(this);
    
    client.guilds = [];
    
    client.connecting = false;
    client.ready = false;
    client.pings = [];
    client._token = token;
    client._seq = null;
    
    client.presence = {
        game: null,
        status: "online",
//        since: Date.now(),
        since: null,
        afk: false
    }
    
    
    this.voiceConnect = function(guild, channel){
        if(client.guilds.length === 0){
            return;
        }
        client._voiceState = null;
        client._voiceServer = null;
        client.guilds.forEach(i => {
            if(i.id === guild){
                i.channels.forEach(j => {
                    if(j.id === channel){
                        send(Disco.Payloads.VOICE_UPDATE(guild, channel, false, false));
                    }
                });
            }
        });
    }
    
    
    function connect(){
        client.emit('connecting');
        API('get', Disco.Endpoints.GATEWAY, (err, res, body) => {
            if(err){
                console.error(err, res);
                client.emit('error', err, res);
            } else {
                body = JSON.parse(body);
                console.log(body);
                if(client._socketOpen){
                    client._socket.close(1001, "Disconnecting");
                }
                client._gatewayURL = body.url + "/?encoding=json&v=" + Disco.GATEWAY_VERSION;
                client._socket = new WebSocket(client._gatewayURL);
                client.connecting = true;
                client._socketOpen = true;
                
                client._socket.once('close', hSocketClose);
                client._socket.once('error', hSocketClose);
                client._socket.on('message', hSocketMessage);
            }
        });
    }
    connect();
    
    function hSocketClose(code, data){
        console.error(code, data);
        client.connecting = false;
        client.ready = false;
    }
    
    function hSocketMessage(data, flags){
        let message = serializeSocketMessage(data, flags);
        console.log(message);
        client.emit('any', message);
        
        switch(message.op){
            case 0: //Dispatch | Receive | dispatches an event
                client._seq = message.s;
                break;
            case 1: //Heartbeat | Send/Receive | used for ping checking
                send(Disco.Payloads.HEARTBEAT(client));
                break;
            case 2: //Identify | Send | used for client handshake
                break;
            case 3: //Status Update | Send | used to update the client status
                break;
            case 4: //Voice State Update | Send | used to join/move/leave voice channels
                break;
            case 6: //Resume | Send | used to resume a closed connection
                break;
            case 7: //Reconnect | Receive | used to tell clients to reconnect to the gateway
                clearTimeout(client._heartbeat);
                client._socket.close(1000, 'Reconnect requested by Discord');
                break;
            case 8: //Request Guild Members | Send | used to request guild members
                break;
            case 9: //Invalid Session | Receive | used to notify client they have an invalid session id
                if(message.d){
                    idResume();
                } else {
                    client._seq = null;
                    client._sessionID = null;
                    setTimeout(function() {
                        idResume();
                    }, Math.random()*4000+1000);
                }
                break;
            case 10: //Hello | Receive | sent immediately after connecting, contains heartbeat and server debug information
                client._hbAckd = true;
                client._hbIntvl = message.d.heartbeat_interval;
                console.log('heartbeat interval:', client._hbIntvl);
                client._hb = setInterval(heartbeat, client._hbIntvl);
                idResume();
                break;
            case 11: //Heartbeat ACK | Receive | sent immediately following a client heartbeat that was received
                client._hbAckd = true;
                console.log('received heartbeat');
                client.pings.unshift(Date.now() - client._lastHb);
                if(client.pings.length > 10){
                    client.pings.pop();
                }
                break;
        }
        
        if(message.op === 0){
            let event = message.t;
            
            switch(event){
                case "READY":
                    console.log("ready!");
                    client.user = message.d.user;
                    //client.guilds = message.d.guilds;
                    client._sessionID = message.d.session_id;
                    
                    client.ready = true;
                    client.connecting = false;
                    
                    getOauth();
                    break;
                case "GUILD_CREATE":
                    client.guilds.push(message.d);
                    break;
                case "MESSAGE_CREATE":
                    client.emit('message', message.d);
                    break;
                case "VOICE_STATE_UPDATE":
                    if(client._voiceState === null){
                        client._voiceState = message.d;
                    }
                    break;
                case "VOICE_SERVER_UPDATE":
                    client._voiceServer = message.d;
                    joinVoiceChannel();
            }
        }
    }
    
    function heartbeat(){
        client._lastHb = Date.now();
        if(client._hbAckd){
            client._hbAckd = false;
            console.log('send heartbeat');
            send(Disco.Payloads.HEARTBEAT(client));
        } else {
            console.error('close');
            client._socket.close(1001, "No heartbeat received");
            client._socketOpen = false;
        }
    }
    
    function serializeSocketMessage(data, flags){
        console.log('flags:', flags);
        flags = flags || {};
        return (data instanceof Buffer) ? JSON.parse(Zlib.inflateSync(data).toString()) : JSON.parse(data);
    }
    
    function idResume(){
        if(client._seq && client._token && client._sessionID){
            console.log('resume');
            send(Disco.Payloads.RESUME(client));
        } else {
            console.log('identify');
            send(Disco.Payloads.IDENTIFY(client));
        }
    }
    
    function send(data){
        if(client._socket && client._socket.readyState == 1){
            console.log(" > send", data)
            client._socket.send(JSON.stringify(data));
        }
    }
    
    function API(method, url, cb){
        method = method.toUpperCase();
        let options = {
            url,
            method,
            headers: {
                'Authorization': 'Bot ' + client.token,
                'User-Agent': `DiscordBot (https://github.com/torcado194/disco, ${Disco.VERSION})`,
                'accept': '*/*'
            }
        }
        request(options, cb);
    }
    
    function getOauth(){
        API('get', Disco.Endpoints.OAUTH, (err, res, body) => {
            console.log(body);
            client._oauth = JSON.parse(body);
        });
    }
    
    function joinVoiceChannel(){
        if(client._voiceSocketOpen){
            client._voiceSocket.close(1001, "Disconnecting");
        }
        client._voiceGatewayURL = "wss://" + client._voiceServer.endpoint;
        client._voiceSocket = new WebSocket(client._voiceGatewayURL);
        client._voiceSocketOpen = true;
        
        client._socket.once('close', hVoiceSocketClose);
        client._socket.once('error', hVoiceSocketClose);
        client._socket.on('message', hVoiceSocketMessage);
        
        DNS.lookup(client._voiceServer.endpoint, (err, address) => {
            if(err){
                console.error(err);
            } else {
                client._voiceAddress = address;
                client._udpSocket = UDP.createSocket("udp4");
                client._udpSocket.bind({exclusive: true});
                
                client._udpSocket.once('message', udpDiscoverResponse);
            }
        });
    }
    
    function hVoiceSocketClose(code, data){
        console.error(code, data);
        client._voiceSocketOpen = false;
    }
    
    function hVoiceSocketMessage(data, flags){
        let message = serializeSocketMessage(data, flags);
        console.log("voice:", message);
        
        switch(message.op){
            case 2: //Ready 
                /*{
                    "ssrc": 1,
                    "ip": "127.0.0.1",
                    "port": 1234,
                    "modes": ["plain", "xsalsa20_poly1305"],
                    "heartbeat_interval": 1
                }*/
                client._voiceServerOptions = message.d;
                //discover UDP ip/port
                let ssrc = client._voiceServerOptions.ssrc;
                let udpDiscoverPacket = (new Buffer(70)).writeUIntBE(ssrc, 0, 4);
                //send discover buffer
                client._voiceIP = null;
                client._voicePort = null;
                client._udpSocket.send(udpDiscoverPacket, 0, udpDiscoverPacket.length, client._voiceServerOptions.port, client._voiceAddress, (err) => {
                    if(err){
                        console.error(err);
                        leaveVoiceChannel();
                    }
                });
                break;
            case 4: //Session description
                /*let v = {
                    "mode": "xsalsa20_poly1305",
                    "secret_key": [ ...251, 100, 11...]
                }*/
                client._voiceSession = message.d;
                break;
            case 6: //Heartbeat ACK 
                client._voiceHbAckd = true;
                console.log('received heartbeat');
                //client.pings.unshift(Date.now() - client._voiceLastHb);
                //if(client.pings.length > 10){
                //    client.pings.pop();
                //}
                break;
            case 8: //Hello 
                client._voiceHbAckd = true;
                client._voiceHbIntvl = message.d.heartbeat_interval;
                console.log('voice heartbeat interval:', client._voiceHbIntvl);
                client._voiceHb = setInterval(voiceHeartbeat, client._voiceHbIntvl);
                voiceIdentify();
                break;
        }
    }
    
    function voiceHeartbeat(){
        client._lastVoiceHb = Date.now();
        if(client._voiceHbAckd){
            client._voiceHbAckd = false;
            console.log('send heartbeat');
            send(Disco.VoicePayloads.HEARTBEAT(client));
        } else {
            console.error('close');
            client._voiceSocket.close(1001, "No heartbeat received");
            client._voiceSocketOpen = false;
        }
    }
    
    function voiceIdentify(){
        console.log('voice identify');
        send(Disco.VoicePayloads.IDENTIFY(client));
    }
    
    function udpDiscoverResponse(msg){
        let buffArr = JSON.parse(JSON.stringify(msg)).data;
        let IP = "";
        let port = 0;
        for (var i = 4; i < buffArr.indexOf(0, i); i++) {
            IP += String.fromCharCode(buffArr[i]);
        }
        port = msg.readUIntLE(msg.length - 2, 2).toString(10);
        
        client._voiceIP = IP;
        client._voicePort = port;
        
        send(Disco.VoicePayloads.PROTOCOL(client));
    }
    
    
}
util.inherits(Disco.Client, Emitter);

{
    let API = "https://discordapp.com/api",
        CDN = "https://cdn.discordapp.com",
        ME = API + "/users/@me";
    
    Disco.Endpoints = {
        API,
        CDN,
        ME,
//        GATEWAY: API + "/gateway/bot",
        GATEWAY: API + "/gateway",
        OAUTH: API + "/oauth2/applications/@me"
    }
}

Disco.Payloads = {
    IDENTIFY: client => ({
        op: 2,
        d: {
            token: client._token,
            properties: {
                $os: require('os').platform(),
                $browser: "disco",
                $device: "disco"
            },
            compress: true,
            large_threshold: 250,
            presence: client.presence
        }
    }),
    RESUME: client => ({
        op: 6,
        d: {
            token: client._token,
            session_id: client._sessionID,
            seq: client._seq
        }
    }),
    HEARTBEAT: client => ({
        op: 1,
        d: client._seq
    }),
    VOICE_UPDATE: (guild_id, channel_id, self_mute, self_deaf) => ({
        op: 4,
        d: {
            guild_id,
            channel_id,
            self_mute,
            self_deaf
        }
    }),
}
Disco.VoicePayloads = {
    IDENTIFY: client => ({
        op: 0,
        d: {
            server_id: client._voiceState.guild_id,
            user_id: client._voiceState.user_id,
            session_id: client._voiceState.session_id,
            token: client._voiceServer.token
        }
    }),
    HEARTBEAT: client => ({
        op: 3,
        d: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
    }),
    PROTOCOL: client => ({
        op: 1,
        d: {
            protocol: "udp",
            data: {
                address: client._voiceIP,
                port: client._voicePort,
                mode: "xsalsa20_poly1305"
            }
        }
    }),
}


module.exports = Disco;


function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}


process.on('SIGINT', () => {
    Disco.clients.forEach(i => {
        i._socket.close(1001, "Disconnecting");
        console.log('closing');
    })
    process.exit();
})




/*

const ws = new WebSocket('ws://www.host.com/path');

ws.on('open', function open() {
    ws.send('something');
});

ws.on('message', function incoming(data) {
    console.log(data);
});

*/