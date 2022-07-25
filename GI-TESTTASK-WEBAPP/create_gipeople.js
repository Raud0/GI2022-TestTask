var pgtools = require('pgtools');
var pg = require('pg');
var config = require('config');

var pg_config = {
    user: config.get('database.user'),
    host: config.get('database.host'),
    password: config.get('database.password'),
    port: config.get('database.port')
};

pgtools.createdb(pg_config, "GI_PEOPLE", function(err, res) {
    if (err) {
        console.error(err);
        process.exit(-1);
    }
    console.log(res);
});
