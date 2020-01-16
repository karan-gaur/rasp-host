// Default Packages.
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var logger = require('morgan');
var cors = require('cors');
var mongoose = require('mongoose');

// Imported files.
var hostRouter = require('./routes/host');
var authRouter = require('./routes/auth');
var config = require('./config');

var app = express();
mongoose.connect(config.dbConnectString, { useUnifiedTopology: true, useCreateIndex: true, useNewUrlParser: true });
global.User = require('./models/user');

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Handling Default routes
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
  res.sendStatus(err.status || 500);
});

module.exports = app;
