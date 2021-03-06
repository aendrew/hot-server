#!/usr/bin/env node

var express = require('express')
var serveStatic = require('serve-static')
var serveIndex = require('serve-index')
var SocketServer = require('ws').Server

var fs = require('fs')
var chokidar = require('chokidar')
var child = require("child_process");

// set up express static server with a websocket
var PORT = process.env.PORT || 3000

var server = express()
  .get('*', injectHTML)
  .use(serveStatic('./'))
  .use('/', serveIndex('./', {'icons': true}))
  .listen(PORT, () => child.exec("open http://localhost:" + PORT))

var wss = new SocketServer({ server })
wss.on('connection', (ws) => {
  console.log('Client connected')
  ws.on('close', () => console.log('Client disconnected'))
})


// append websocket/injecter script to all html pages served 
var wsInject = fs.readFileSync(__dirname + '/ws-inject.html', 'utf8')
function injectHTML(req, res, next){
  try{
    var path = req.params[0].slice(1)
    if (path.slice(-1) == '/') path = path + '/index.html'
    if (path.slice(-5) != '.html') return next()

    var html = fs.readFileSync(path, 'utf-8') + wsInject
    res.send(html)
  } catch(e){
    next() 
  }
}


// if a .js or .css files changes, load and send to client via websocket
chokidar.watch(['./'], {ignored: /[\/\\]\./ }).on('all', function(event, path) {
  if (event != 'change') return
  console.log('updating ' + path)

  if (~path.indexOf('.js')){
    var msg = {type: 'jsInject', str: fs.readFileSync(path, 'utf8')}
    sendToAllClients(msg)
  }

  if (~path.indexOf('.css')){
    var msg = {type: 'cssInject', str: fs.readFileSync(path, 'utf8')}
    sendToAllClients(msg)
  }
})

// todo - only send to active clients that have loaded the linked find before
function sendToAllClients(msg){
  wss.clients.forEach(d => d.send(JSON.stringify(msg)))
}