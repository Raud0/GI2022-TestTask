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

var { Pool } = require('pg');

var pool = new Pool({
  user: config.get('database.user'),
  host: config.get('database.host'),
  database: 'GI_PEOPLE',
  password: config.get('database.password'),
  port: config.get('database.port')
});

const queryCreateTablePeople = 'CREATE TABLE "people" ("id" SERIAL, "id_code" VARCHAR(11), "first_name" VARCHAR(64), "last_name" VARCHAR(64), "email" VARCHAR(255), "male" BOOLEAN, "code" VARCHAR(44), "dep" VARCHAR(32), "visit_time" TIMESTAMP, "age_at_visit" INT2);';

;(async () => {
  // note: we don't try/catch this because if connecting throws an exception
  // we don't need to dispose of the client (it will be undefined)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(queryCreateTablePeople);
    console.log(res.rows[0]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
})().catch(e => console.error(e.stack));