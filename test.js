const Disco = require('./index.js');

const token = require('./token.json').token;

console.log(Disco);

let bot = new Disco.Client(token);
console.log(bot);

bot.on('message', msg => {
    console.log(msg.content);
    
    if(message === '$connect'){
        bot.voiceConnect("227172502114271234");
    }
});