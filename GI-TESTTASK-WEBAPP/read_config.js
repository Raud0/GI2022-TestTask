var config = require('config');

var pg_config = {
    user: config.get('database.user'),
    host: config.get('database.host'),
    password: config.get('database.password'),
    port: config.get('database.port')
};

console.log(pg_config);