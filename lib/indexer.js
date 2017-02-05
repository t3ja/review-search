var Promise = require("bluebird"),
	natural = require('natural'),
	tokenizer = new natural.WordTokenizer();

function Indexer(options){
	options = options || {};
	this.db = options.db;
	this.tokenizer = options.tokenizer || new natural.WordTokenizer();
	this.stemmer = options.stemmer || natural.PorterStemmer;
	this.stemmer.attach();
}

//Indexer to tokenize input strings
Indexer.prototype.getTerms = function(body){
	return new Promise(function (resolve, reject) {
		try{
			var terms = tokenizer.tokenize(body);
			resolve(terms);
		} catch(err){
			reject(new Error('Error while parsing document for terms: ' + err.message));
		}
	}.bind(this));
};


module.exports = Indexer;
