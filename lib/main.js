var express = require('express'),
app = express(),
Promise = require('bluebird'),
logger = require('./logger'),
bodyParser = require('body-parser'),
responseTime = require('response-time'),
Trie = require('./customTrie'),
natural = require('natural'),
tokenizer = new natural.WordTokenizer();

//Express plugin to measure response time of APIs
app.use(responseTime());
app.get('/search', 	genericSearch(false));				//Brute Search
app.get('/searchTrie', genericSearch(true));  	  //Search by Trie



function searchBrute(queryTerms, docs){
	//Brute search all the docs by iterating and finding the queryTerms in the tokens
	return new Promise(function (resolve, reject) {
		var results = new Array();
		logger.info('Searching(Brute) all ', docs.length, ' reviews for terms - ', queryTerms);
		docs.forEach(function(doc){
			doc.score = 0;
			queryTerms.forEach(function(q, ind){
				if(doc.tokens.indexOf(q) > -1){
					doc.score++;
				}
			});
			//Calculate the doc score here before resolving the results
			if(doc.score > 0){
				delete doc['tokens'];
				doc.score = (doc.score / queryTerms.length).toFixed(2) || 0;
				results.push(doc);
			}
		});
		resolve(results);
	}.bind(this));
}

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
}

function getDocsWithScores(ids, queryTerms){
	//Retrieve docs from DB from the input id list and return the docs with scores
	var counterObj = {}
	//Here, counterObj contains mapping of id and count of duplicates(HashMap)
	ids.forEach(function(id) {
		counterObj[id.toString()] = (counterObj[id.toString()] || 0) + 1
	});
	//Get the documents from list of ids
	return new Promise(function (resolve, reject) {
		app.get('db').retrieveDocs(Object.keys(counterObj)).bind(this).then(function(docs){
			//Calculate and attach score to the doc from counterObj
			docs.forEach(function(doc){
				doc['score'] = (counterObj[doc._id.toString()] / queryTerms.length).toFixed(2) || 0;
				delete doc['tokens'];
			});
			resolve(docs);
		});
	}.bind(this));
}

function getTerms(reqBody){
	return new Promise(function (resolve, reject) {
		try{
			var terms = tokenizer.tokenize(reqBody);
			resolve(terms);
		} catch(err){
			reject(new Error('Error while parsing document for terms: ' + err.message));
		}
	}.bind(this));
}


function genericSearch(isTrie){
	return function(req, res) {
		var qTerms;
		//Convert case
		if (!req.query.q){
			return res.status(400).json({
				status: "error",
				message: "Bad request. The query string is missing"
			});
		}
		req.query.q = req.query.q.toLowerCase();
		getTerms(req.query.q).then(function(queryTerms){
			qTerms = queryTerms;
			if(isTrie){
				return new Promise(function (resolve, reject) {
					searchTrie(qTerms).then(function(idList){
						getDocsWithScores(idList, qTerms).then(function(resultDocs){
							resolve(resultDocs);
						});
					});
				}.bind(this));
			}else{
				return new Promise(function (resolve, reject) {
					app.get('db').retrieve().then(function(docs){
						searchBrute(qTerms, docs).then(function(resultDocs){
							resolve(resultDocs);
						});
					});
				}.bind(this));
			}
		}).then(function(resultDocs){
			//Sort the docs on 'score'
			resultDocs.sort(function (a, b) {
				return Number(b.score) - Number(a.score);
			});
			logger.info('Results - ', resultDocs.length);
			res.json({
				query: req.query.q,
				totalResults: resultDocs.length,
				results: resultDocs.slice(0, 20)
			});
		});
	};
}

//Keep the Trie public
var bigTrie = new Trie();

function buildTrie(cb){
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
		var server = app.listen(3000, function() {
			buildTrie(function(){
				logger.info('Simple search server listening on port %d', server.address().port);
				resolve(this);
			});
		});
	});
};
