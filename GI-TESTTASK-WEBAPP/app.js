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
const usersRouter = require('./routes/users');
const { json } = require('body-parser');
const fileUpload = require('express-fileupload');
const { parse } = require('path');
const { timeStamp } = require('console');
const { Stream } = require('stream');

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
app.use('/users', usersRouter);

app.post('/data', async(req,res) => {
  if(!req.files) {
    res.redirect(500,'/');
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

    res.redirect(200,'/');
  }
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
});

module.exports = app;

async function uploadFiles(filenames) {
  var pool = new Pool({
    user: config.get('database.user'),
    host: config.get('database.host'),
    database: 'GI_PEOPLE',
    password: config.get('database.password'),
    port: config.get('database.port')
  });
  
  const queryCreateTablePeople = 'CREATE TABLE IF NOT EXISTS "people" ("id" SERIAL PRIMARY KEY, "id_code" VARCHAR(32), "first_name" VARCHAR(64), "last_name" VARCHAR(64), "email" VARCHAR(255), "sex" VARCHAR(1), "code" VARCHAR(64), "dep" VARCHAR(32), "visit_time" TIMESTAMP, "age_at_visit" INT2);';
  const queryInsertIntoPeople = 'INSERT INTO "people" ("id_code", "first_name", "last_name", "email", "sex", "code", "dep", "visit_time", "age_at_visit") VALUES %L';
  
  ;(async () => {
    // note: we don't try/catch this because if connecting throws an exception
    // we don't need to dispose of the client (it will be undefined)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const resToTableCreation = await client.query(queryCreateTablePeople);
      
      for (let i in filenames) {
        let filename = filenames[i];
        let filepath = './uploads/' + filename;

        // REGEX for column mapping
        let id_code_col = -1;
        const id_code_re = /.*((((id(ent.*)?)|(insurance))[-_ ]?((code)|(n(umbe)?r)))|(((id(ent.*)?)|(isiku))[-_ )]?((kood)|(n(umbe)?r)))|(id(ent.*)?))/;
        let first_name_col = -1;
        const first_name_re = /(((1)|(first)|(fore))(.*na?me?)?)|(((1)|(ees)|(esi))(.*ni?mi?)?)/;
        let last_name_col = -1;
        const last_name_re = /(((2)|(second)|(sur)|(family)|(last))(.*na?me?)?)|(((2)|(pere)|(teine))(.*ni?mi?)?)/;
        let email_col = -1;
        const email_re = /e?[-_ ]?(m(a|e)il)(.*((aad)|(add)|(adr)).*)?/;
        let code_col = -1;
        const code_re = /(co?de?)|(k(oo)?d)(\.)?/;
        let dep_col = -1;
        const dep_re = /(de?pa?r?t?m?e?n?t?)|(osa?(ko?nd)?)/;
        let visit_time_col = -1;
        const visit_time_re = /((vi?si?t)?[-_ ]?time)|(((visiidi)|(k.?la?stus))?[-_ ]?aeg)/;

        const values = [];
        let j = 0;

        const readFileIntoDatabase = (file) => new Promise((resolve, reject) => {
          var instream = fs.createReadStream(file);
          var outstream = new Stream;
          const rl = readline.createInterface(instream, outstream);
          
          instream.on('end', resolve);
          rl.on('line', (line) => {
            if (j) {
              // when not on first line of file, give values based on column map
              let value = [null,null,null,null,null,null,null,null,null];
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
              //8: age at visit, bound to produce some innacuracies
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
              values[j - 1] = value;
            } else {
              // when on first line of file, map columns
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
                  console.log("Could not match string " + columnstring + "!");
                }
              }
            }
            j++;

            if (values.length >= 950) {
              const resToTableInsertion = client.query(pgFormat(queryInsertIntoPeople, values));
              //console.log("Inserted some rows of " + filepath);
              values.length = 0;
              j = 1;
            }
          });
        });
        
        console.log("STARTED READING FILE INTO DATABASE: " + filepath);
        await readFileIntoDatabase(filepath);
        
        
        const resToTableInsertion = await client.query(pgFormat(queryInsertIntoPeople, values));
        //console.log("Inserted last rows of " + filepath);
        
        
        console.log("FINISHED READING FILE INTO DATABASE: " + filepath);

        fs.unlink(filepath, (err) => {
          if (err) {
            throw err;
          }
        });
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  })().catch(e => console.error(e.stack));
}