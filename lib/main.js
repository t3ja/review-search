var express = require('express'),
app = express(),
Promise = require('bluebird'),
Indexer = require('./indexer'),
logger = require('./logger'),
bodyParser = require('body-parser'),
responseTime = require('response-time'),
Trie = require('./customTrie');

// app.use(bodyParser.json({ extended: true }));
// app.use(bodyParser.urlencoded({ extended: true }));
//Express plugin to measure response time of APIs
app.use(responseTime());


Array.prototype.unique = function() {
	return this.reduce(function(accum, current) {
		if (accum.indexOf(current) < 0) {
			accum.push(current);
		}
		return accum;
	}, []);
}





//URL routes
app.get('/search', processSearch);					//Brute Search

app.get('/searchTrie', processSearchTrie);  //Search by Trie





function removeDuplicates(originalArray, prop) {
	//Removes duplicates from an array of objects based on given property
	var newArray = new Array();
	var lookupObject  = {};
	for(var i in originalArray) {
		lookupObject[originalArray[i][prop]] = originalArray[i];
	}
	for(i in lookupObject) {
		newArray.push(lookupObject[i]);
	}
	return newArray;
}


function scoreDocs(docsList, numQueryTerms){
	//Calculate score of each doc by counting the number of duplicates and normalizing it with number of query terms
	//Also, delete the tokens in response
	var docsWithCounts = {};
	var results = {};
	docsList.forEach(function(x) {
		docsWithCounts[x['_id']] = (docsWithCounts[x['_id']] || 0)+1;
		x['score'] = (docsWithCounts[x['_id']] / numQueryTerms).toFixed(2) || 0;
		delete x['tokens'];
	});
	return docsList;
}


function searchBrute(queryTerms, docs){
	//Brute search all the docs by iterating and finding the queryTermsin the tokens
	return new Promise(function (resolve, reject) {
		var results = new Array();
		logger.info('Searching(Brute) all ', docs.length, ' reviews for terms - ', queryTerms);
		docs.forEach(function(doc){
			doc.score = 0;
			queryTerms.forEach(function(q, ind){
				if(doc.tokens.indexOf(q) > -1){
					results.push(doc);
				}
			});
		});
		resolve(results);
	}.bind(this));
};


function searchTrie(queryTerms){
	//Search the in-memory Trie for the tokens and return the list of indexes of all the results
	return new Promise(function (resolve, reject) {
		var results = new Array();
		logger.info('Searching(Trie) all reviews for terms - ', queryTerms);
		queryTerms.forEach(function(q){
			var t = bigTrie.get(q);
			if(t) results = results.concat(t);
		});
		resolve(results);
	}.bind(this));
};

function getDocs(ids){
	//Get the documents from list of indexes
	return new Promise(function (resolve, reject) {
		var results = new Array();
		app.get('db').retrieveDocs(ids).bind(this).then(function(docs){
			resolve(docs);
		});
	}.bind(this));
}

function processSearch(req, res){
	//Controller function for Brute search
	var query = req.query.q,
	indexName = req.params.indexName;
	var qTerms = [];
	var error;
	if (!query){
		res.status(400).json({
			status: "error",
			message: "Bad request. The query string is missing"
		});
	} else {
		app.get('indexer').getTerms(query).then(function(queryTerms){
			qTerms = queryTerms;
			return app.get('db').retrieve();
		}).then(function(docs){
			return searchBrute(qTerms, docs);
		}).then(function(resultDocs){
			resultDocs = resultDocs.sort(function (a, b) {
				return a['_id'] < b['_id'];
			});
			var tempResults = removeDuplicates(scoreDocs(resultDocs, qTerms.length), '_id');
			tempResults = tempResults.sort(function (a, b) {
				return a['score'] < b['score'];
			});
			var outResults = Array.prototype.slice.call(tempResults, 0, 20);
			logger.info('Results - ', resultDocs.length);
			res.json({
				query: query,
				totalResults: tempResults.length,
				results: outResults
			});
		});
	}
}


function processSearchTrie(req, res){
	//Controller function for Trie based search
	var query = req.query.q,
	indexName = req.params.indexName;
	var qTerms = [];
	var error;
	if (!query){
		res.status(400).json({
			status: "error",
			message: "Bad request. The query string is missing"
		});
	} else {
		app.get('indexer').getTerms(query).then(function(queryTerms){
			qTerms = queryTerms;
			return searchTrie(queryTerms);
		}).then(function(idList){
			getDocs(idList).then(function(resultDocs){
				//Sort the docs on '_id'
				resultDocs = resultDocs.sort(function (a, b) {
					return a['_id'] < b['_id'];
				});
				//First, calculate score for every document and then sort the docs by calculated score
				var tempResults = removeDuplicates(scoreDocs(resultDocs, qTerms.length), '_id');
				tempResults = tempResults.sort(function (a, b) {
					return a['score'] < b['score'];
				});
				//Slice the results to include 20 results(Note : Array.prototype.slice is mutable)
				var outResults = Array.prototype.slice.call(tempResults, 0, 20);
				logger.info('Results - ', resultDocs.length);
				res.json({
					query: query,
					totalResults: tempResults.length,
					results: outResults
				});
			});

		});
	}
}




//Keep the Trie public
var bigTrie = new Trie();

function testTrie(cb){
	//On app start, insert all tokens into a Trie with indexes
	app.get('db').retrieve().then(function(docs){
		logger.info('Constructing a Trie with all ', docs.length, ' records.');
		docs.forEach(function(doc){
			doc.tokens.forEach(function(token){
				bigTrie.put(token, doc._id.toString());
			});
		});
		return bigTrie;
	}).then(function(bTrie){
		logger.info('Trie construction done');
		cb();
	});

}

exports.setDb = function(db){
	return new Promise(function (resolve, reject) {
		app.set('db', db);
		resolve();
	});
};

exports.start = function(){
	return new Promise(function (resolve, reject) {
		if (!app.get('db')){
			reject(new Error("Cannot initialize search engine without a database."));
		}
		app.set('indexer', new Indexer({
			db: app.get('db')
		}));
		var server = app.listen(3000, function() {
			testTrie(function(){
				logger.info('Simple search server listening on port %d', server.address().port);
				resolve(this);
			});
		});
	});
};
