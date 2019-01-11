const Disco = require('./index.js');

const token = require('./token.json').token;

console.log(Disco);

let bot = new Disco.Client(token);
console.log(bot);

bot.on('message', msg => {
    console.log(msg.content);
    console.log(msg.content === "$connect");
    if(msg.content === '$connect'){
        bot.voiceConnect("227172502114271233", "227172502114271234"); //test
        bot.voiceConnect("120888645178753024", "336349159114145792"); //drawsquad
    }
});