const Disco = require('./index.js');

const token = require('./token.json').token;

console.log(Disco);

let bot = new Disco.Client(token);
console.log(bot);