var config = require('config');

var { Pool } = require('pg');

var pool = new Pool({
  user: config.get('database.user'),
  host: config.get('database.host'),
  database: 'GI_PEOPLE',
  password: config.get('database.password'),
  port: config.get('database.port')
});

const queryNow = 'SELECT NOW()';

;(async () => {
  // note: we don't try/catch this because if connecting throws an exception
  // we don't need to dispose of the client (it will be undefined)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const res = await client.query(queryNow);
    console.log(res.rows[0]);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
})().catch(e => console.error(e.stack));
