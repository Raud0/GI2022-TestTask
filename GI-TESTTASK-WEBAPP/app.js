const createError = require('http-errors');
const express = require('express');
const path = require('path');
const fileUploader = require('express-fileupload');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const { json } = require('body-parser');
const fileUpload = require('express-fileupload');


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

    for(let i in resDatafiles) {
      let datafile = resDatafiles[i];
      datafile.mv('./uploads/' + datafile.name)
    }
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
