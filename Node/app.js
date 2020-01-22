// Default Packages.
const cors = require('cors');
const logger = require('morgan');
const express = require('express');
const mongoose = require('mongoose');
const createError = require('http-errors');
const fileUpload = require('express-fileupload');

// Imported files.
const config = require('./config');
const hostRouter = require('./routes/host');
const authRouter = require('./routes/auth');

const app = express();
global.User = require('./models/user');
mongoose.connect(config.dbConnectString, { useUnifiedTopology: true, useCreateIndex: true, useNewUrlParser: true });

app.use(cors());
app.use(fileUpload());
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
