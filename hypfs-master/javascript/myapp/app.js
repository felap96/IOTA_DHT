'use strict';
const express = require('express');
const path = require('path');
var bodyParser = require('body-parser');


const app = express();

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));


var index = require('./routes/index.js')
var insert = require('./routes/insert.js')
var superset_search = require('./routes/superset_search.js')
var pin_search = require('./routes/pin_search.js')
var remove = require('./routes/remove.js')

app.use(index);
app.use(insert);
app.use(superset_search)
app.use(pin_search)
app.use(remove)


app.listen(port, () => {
  console.log(`app listening at http://localhost:${port}`)
})




