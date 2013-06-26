var express = require('express'),
    app = express()

app.use(express.static(__dirname + '/static'))
app.use(express.static(__dirname + '/static/index.html'))
// Route all other URI's through index.html, where the
// backbone router should pick things up
app.get('/*', function(req, res) {
  res.sendfile(__dirname + '/static/index.html');
})

app.listen(8000)

