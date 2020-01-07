// Default Packages.
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// Imported files.
var indexRouter = require('./routes/index');
var hostRouter = require('./routes/host');
var authRouter = require('./routes/auth');
var config = require('./config');

// Added Packages.
var session = require('express-session');
var mongoose = require('mongoose');
var passport = require('passport')
var flash = require('express-flash')

var app = express();
mongoose.connect(config.dbConnectString, { useUnifiedTopology: true, useCreateIndex: true, useNewUrlParser: true });
global.User = require('./models/user');

// view engine setup.
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(flash())
app.use(session({ 
    secret : config.sessionKey,
    resave : false,
    saveUninitialized : false,
    cookie: { 
        secure: false
    }
}));
app.use(function(req, res, next){
  if(req.isAuthenticated()){
    res.locals.user = req.user;
  }
  next();
});

// Configuring Passport.
app.use(passport.initialize());
app.use(passport.session());

// Handling Default routes
app.use('/', indexRouter);
app.use('/', hostRouter);
app.use('/', authRouter);

// Catch 404 and forward to error handler.
app.use(function(req, res, next) {
  next(createError(404));
});

// Error Handler.
app.use(function(err, req, res, next) {
  // Set locals, only providing error in development.
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // Render the error page.
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
