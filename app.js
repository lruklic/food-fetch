/* require('dotenv').config({path: __dirname + '/.env'})
const express = require("express")
const app = express()
const PORT = process.env.PORT || 3000

const token = process.env.BOT_TOKEN
const eventsApi = require('@slack/events-api')
const slackEvents = eventsApi.createEventAdapter(process.env.SIGNING_SECRET)
const { WebClient, LogLevel } = require("@slack/web-api");
const client = new WebClient(token, {
    logLevel: LogLevel.DEBUG
});
app.use('/', slackEvents.expressMiddleware())
slackEvents.on("message", async(event) => {
    console.log(event)
})

app.listen(PORT, () => {
    console.log(`App listening at http://localhost:${PORT}`)
})

module.exports = app; */

require('dotenv').config({path: __dirname + '/.env'})

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var puppetRouter = require('./routes/restaurants/puppet');

var app = express();

/* // Slack app
const token = process.env.BOT_TOKEN
console.log(token);
const eventsApi = require('@slack/events-api')
console.log(process.env.SIGNING_SECRET)
const slackEvents = eventsApi.createEventAdapter(process.env.SIGNING_SECRET)
const { WebClient, LogLevel } = require("@slack/web-api");
const client = new WebClient(token, {
    logLevel: LogLevel.DEBUG
}); */

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/* app.use('/', slackEvents.expressMiddleware()) */
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/puppet', puppetRouter);

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
