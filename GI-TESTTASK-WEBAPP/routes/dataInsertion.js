var express = require('express');
var router = express.Router();

/* GET data insertion page page. */
router.get('/', function(req, res, next) {
  res.render('dataInsertion', {});
});

module.exports = router;
