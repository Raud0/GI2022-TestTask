const createError = require('http-errors');
const express = require('express');
const path = require('path');
const fileUploader = require('express-fileupload');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const readline = require('readline');
const fs = require('fs');
var pgFormat = require('pg-format');
var { Pool } = require('pg');
var config = require('config');

const indexRouter = require('./routes/index');
const datainsertionRouter = require('./routes/dataInsertion')
const dataviewRouter = require('./routes/dataView')
const { json } = require('body-parser');
const fileUpload = require('express-fileupload');
const { parse } = require('path');
const { timeStamp } = require('console');
const { Stream } = require('stream');
const { rows } = require('pg/lib/defaults');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUploader({
  createParentPath: true
}))
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/dataInsertion', datainsertionRouter);
//app.use('/dataView', dataviewRouter);

app.post('/dataInsertionRequest', async(req,res) => {
  if(!req.files) {
    return res.redirect(500,'/');
  } else {
    let resDatafiles = req.files.datafiles;
    if (!(Object.prototype.toString.call(resDatafiles) === '[object Array]')) {
      resDatafiles = [resDatafiles];
    }

    let datafilenames = [];
    for(let i in resDatafiles) {
      let datafile = resDatafiles[i];
      await datafile.mv('./uploads/' + datafile.name)
      datafilenames[i] = datafile.name;
    }
    uploadFiles(datafilenames);

    return res.redirect(302,'/dataInsertion');
  }
});
app.post('/dataViewRequest', async(req,res) => {
  let id = ''
  if(req.body.id_code) {
    id = req.body.id_code;
  }
  let limit = 50;
  if(req.body.limit) {
    limit = parseInt(req.body.limit);
  }
  let offset = 0;
  if(req.body.offset) {
    offset = parseInt(req.body.offset);
  }
  if (req.body.arrow == '<') {
    offset = Math.max(offset - 1,0);
  } else if (req.body.arrow == '>') {
    offset = offset + 1;
  }
  return res.redirect(301,'/dataView?id=' + id + '&limit=' + limit + '&offset=' + offset);
});
app.get('/dataView', async(req, res) => {
  const id = req.query.id;
  const limit = req.query.limit;
  const offset = req.query.offset;
  const dataRes = await getData(id, limit, offset);

  res.render('dataView', {
    id: id,
    limit: parseInt(limit),
    offset: parseInt(offset),
    dataString: JSON.stringify(dataRes)
  });
});
app.post('/returnRequest', async(req,res) => {
  return res.redirect(302,'/');
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');

  return ;
});

module.exports = app;

async function getData(id, limit, offset) {
  const id_code_query = 'SELECT * FROM people WHERE id_code LIKE \'%s%%\' ORDER BY id LIMIT %s OFFSET %s;';
  const format_id_code_query = pgFormat(id_code_query, id, String(limit), String(limit * offset));
  
  var pool = new Pool({
    user: config.get('database.user'),
    host: config.get('database.host'),
    database: 'GI_PEOPLE',
    password: config.get('database.password'),
    port: config.get('database.port')
  });

  var data = null;
  const readFileIntoDatabase = (query) => new Promise((resolve, reject) => {
    pool.connect((err, client, done) => {
      if (err) throw err
      client.query(query, (err, res) => {
        done()
        if (res) {
          data = res.rows;
        }
        resolve();
      })
    })
  });
  await readFileIntoDatabase(format_id_code_query);
  return data;
}

async function uploadFiles(filenames) {
  var pool = new Pool({
    user: config.get('database.user'),
    host: config.get('database.host'),
    database: 'GI_PEOPLE',
    password: config.get('database.password'),
    port: config.get('database.port')
  });
  
  // QUERY TEMPLATES
  const queryCreateTablePeople = 'CREATE TABLE IF NOT EXISTS "people" ("id" SERIAL PRIMARY KEY, "id_code" VARCHAR(32), "first_name" VARCHAR(64), "last_name" VARCHAR(64), "email" VARCHAR(255), "sex" VARCHAR(1), "code" VARCHAR(64), "dep" VARCHAR(32), "visit_time" TIMESTAMP, "age_at_visit" INT2);';
  const queryInsertIntoPeople = 'INSERT INTO "people" ("id_code", "first_name", "last_name", "email", "sex", "code", "dep", "visit_time", "age_at_visit") VALUES %L';

  // COLUMN LABEL MAPPING REGEX
  const id_code_re = /.*((((id(ent.*)?)|(insurance))[-_ ]?((code)|(n(umbe)?r)))|(((id(ent.*)?)|(isiku))[-_ )]?((kood)|(n(umbe)?r)))|(id(ent.*)?))/;
  const first_name_re = /(((1)|(first)|(fore))(.*na?me?)?)|(((1)|(ees)|(esi))(.*ni?mi?)?)/;
  const last_name_re = /(((2)|(second)|(sur)|(family)|(last))(.*na?me?)?)|(((2)|(pere)|(teine))(.*ni?mi?)?)/;
  const email_re = /(e(le(c|k).*)?)?[-_ ]?((m(a|e)ili?)|(po?sti?))(.*((aad)|(add)|(adr)).*)?/;
  const code_re = /(co?de?)|(k(oo)?d)(\.)?/;
  const dep_re = /(de?pa?r?t?m?e?n?t?)|(osa?(ko?nd)?)/;
  const visit_time_re = /((vi?si?t)?[-_ ]?time)|(((visiidi)|(k.?la?stus))?[-_ ]?aeg)/;
  
  ;(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log("BEGAN A TRANSACTION WITH THE DATABASE");
      
      const resToTableCreation = await client.query(queryCreateTablePeople);
      
      for (let i in filenames) {
        let filename = filenames[i];
        let filepath = './uploads/' + filename;

        // Unknown columns
        let id_code_col = -1;
        let first_name_col = -1;
        let last_name_col = -1;
        let email_col = -1;
        let code_col = -1;
        let dep_col = -1;
        let visit_time_col = -1;

        // Buffer for uploading multiple
        var insertionValueBuffer = [];
        
        const readFileIntoDatabase = (file) => new Promise((resolve, reject) => {
          var instream = fs.createReadStream(file);
          instream.on('end', resolve);
          var outstream = new Stream;
          
          let j = 0;
          const rl = readline.createInterface(instream, outstream);
          rl.on('line', (line) => {
            if (j) {
              // every value in a row is null unless a proper value can be added
              let value = [null,null,null,null,null,null,null,null,null];
              
              // PARSE LINE
              // no insertion is made if sought column for data was not found (col == -1)
              let strings = line.split(';');
              //0: id code
              if (id_code_col != -1) {
                let potentialId = strings[id_code_col];
                value[0] = potentialId;
              }
              //1: first name
              if (first_name_col != -1) {
                value[1] = strings[first_name_col];
              }
              //2: last name
              if (last_name_col != -1) {
                value[2] = strings[last_name_col];
              }
              //3: email
              if (email_col != -1) {
                let potentialEmail = strings[email_col];
                value[3] = potentialEmail;
              }
              //4: sex
              if (value[0]) {
                let potentialSexMarker = value[0][0];
                if(!isNaN(potentialSexMarker)){
                  let sexMarkerValue = parseInt(potentialSexMarker);
                  let sexMarker = null;
                  if (sexMarkerValue%2 == 0) {
                    sexMarker = "F"
                  } else {
                    sexMarker = "M"
                  }
                  value[4] = sexMarker;
                }
              }
              //5: code
              if (code_col != -1) {
                value[5] = strings[code_col];
              }
              //6: dep
              if (dep_col != -1) {
                value[6] = strings[dep_col];
              }
              //7: visit time
              value[7] = null;
              if (visit_time_col != -1) {
                let potentialVisitTime = strings[visit_time_col];
                let visitTime = null
                try {
                  visitTime = new Date(potentialVisitTime);
                } catch (err) {
                  console.log('Failed to parse datetime value ' + potentialVisitTime);
                }
                value[7] = visitTime;
              }
              //8: age at visit
              if (value[7] && value[0]) {
                let cleanId = value[0];
                cleanId = cleanId.replace(/[^0-9]/g,'');
                cleanId = cleanId.padEnd(11,'0');
                let potentialCenturyMarker = cleanId[0];
                let potentialYearMarker = cleanId.substring(1,3);
                let potentialMonthMarker = cleanId.substring(3,5);
                let potentialDayMarker = cleanId.substring(5,7);
                if (!isNaN(potentialCenturyMarker) && !isNaN(potentialYearMarker) && !isNaN(potentialMonthMarker) && !isNaN(potentialDayMarker)) {
                  let potentialCentury = parseInt(potentialCenturyMarker);
                  let potentialYear = parseInt(potentialYearMarker);
                  let potentialMonth = parseInt(potentialMonthMarker);
                  let potentialDay = parseInt(potentialDayMarker);
                  if (potentialMonth >= 1 && potentialMonth <= 12 && potentialDay >= 1 && potentialDay <= 31) {
                    let year = 100 * (18 + Math.floor((potentialCentury-1)/2)) + potentialYear;
                    let month = potentialMonth;
                    let day = potentialDay;
                    let potentialBirthTime = new Date(year,month,day);
                    let potentialAgeAtVisit = Math.floor((value[7].getTime() - potentialBirthTime.getTime()) / (31557600000));
                    if (potentialAgeAtVisit > 0) {
                      value[8] = potentialAgeAtVisit;
                    }
                  }
                }
              }

              // saving value to insert buffer (j is always 1 or greater here)
              insertionValueBuffer[j - 1] = value;
            } else {
              // assuming first line has column labels and the seperator is ';'
              let columnstrings = line.split(';');
              for (let h in columnstrings) {
                let columnstring = columnstrings[h];
                if (columnstring.match(id_code_re)) {
                  id_code_col = h;
                } else if (columnstring.match(first_name_re)) {
                  first_name_col = h;
                } else if (columnstring.match(last_name_re)) {
                  last_name_col = h;
                } else if (columnstring.match(email_re)) {
                  email_col = h;
                } else if (columnstring.match(code_re)) {
                  code_col = h;
                } else if (columnstring.match(dep_re)) {
                  dep_col = h;
                } else if (columnstring.match(visit_time_re)) {
                  visit_time_col = h;
                } else {
                  console.log("Could not match string " + columnstring + " in file " + file + ".");
                }
              }
            }
            j++;

            // Inserting and emptying valuebuffer, maximum rows you can insert at once is 1000
            if (insertionValueBuffer.length > 999) {
              const resToTableInsertion = client.query(pgFormat(queryInsertIntoPeople, insertionValueBuffer));
              insertionValueBuffer.length = 0;
              j = 1;
            }
          });
        });
        
        console.log("STARTED READING FILE INTO DATABASE: " + filepath);
        
        // Reading all rows and inserting them into the database
        await readFileIntoDatabase(filepath);
        // Inserting rest of the valuebuffer
        if (insertionValueBuffer > 0) {
          const resToTableInsertion = await client.query(pgFormat(queryInsertIntoPeople, insertionValueBuffer));
        }
        
        console.log("FINISHED READING FILE INTO DATABASE: " + filepath);

        // Uploaded file is deleted after finishing
        fs.unlink(filepath, (err) => {
          if (err) {
            throw err;
          }
        });
      }

      await client.query('COMMIT');
      console.log("COMMITTED TRANSACTION TO THE DATABASE");
    } catch (e) {
      await client.query('ROLLBACK');
      console.log("ROLLED BACK TRANSACTION TO THE DATABASE");
      throw e;
    } finally {
      client.release();
    }
  })().catch(e => console.error(e.stack));
}