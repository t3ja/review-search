var Promise = require("bluebird"),
natural = require('natural'),
tokenizer = new natural.WordTokenizer(),
mongodb = Promise.promisifyAll(require('mongodb')),
MongoClient = mongodb.MongoClient;

Array.prototype.unique = function() {
    return this.reduce(function(accum, current) {
        if (accum.indexOf(current) < 0) {
            accum.push(current);
        }
        return accum;
    }, []);
}


var LineByLineReader = require('line-by-line'),
lr = new LineByLineReader('./finefoods.txt', { encoding: 'utf8',
skipEmptyLines: true});

MongoClient.connect('mongodb://127.0.0.1:27017/searchDb', function(err, db) {
  if (err) throw err;
  console.log("Connected to Database");
  lr.on('error', function (err) {
    console.log(err);
  });
  var i = 0, total = 0, j = 0;
  var doc = {};
  function parseLine(line, cb){
    var tokens = [];
    switch(true){
      case (line.indexOf('product/productId') > -1):
      doc.productId = line.slice(19);
      break;
      case (line.indexOf('review/userId') > -1):
      doc.userId = line.slice(15);
      break;
      case (line.indexOf('review/profileName') > -1):
      doc.profileName = line.slice(20);
      break;
      case (line.indexOf('review/helpfulness') > -1):
      doc.helpfulness = line.slice(20);
      break;
      case (line.indexOf('review/score') > -1):
      doc.score = line.slice(14);
      break;
      case (line.indexOf('review/time') > -1):
      doc.time = line.slice(13);
      break;
      case (line.indexOf('review/summary') > -1):
      doc.summary = line.slice(16);
      tokens = tokenizer.tokenize(doc.summary.toLowerCase());
      break;
      case (line.indexOf('review/text') > -1):
      doc.text = line.slice(13);
      tokens = tokenizer.tokenize(doc.text.toLowerCase());
      break;
    }
    doc.tokens = doc.tokens ? doc.tokens.concat(tokens) : tokens;
    doc.tokens = doc.tokens ? doc.tokens.unique() : tokens;
    cb();
  }

  function saveToDb(doc, cb){
    db.collection('reviews').insert(doc, function(err, records) {
      if (err) return cb(err);
      console.log(total++, " - Review added");
      return cb(null);
    });
  }

  // while (i < 100000){
  //
  // }

  lr.on('line', function (line) {
    if(i < 8){
      lr.pause();
      parseLine(line, function(response){
        i++;
        lr.resume();
      });
    }else{
      //Save to DB
      lr.pause();
      saveToDb(doc, function(response){
        i = 0;
        doc = {};
        lr.resume();
      });
    }
  });

  lr.on('end', function () {
    console.log('File processing complete - ', total, ' records saved');
    // All lines are read, file is closed now.
  });

});
