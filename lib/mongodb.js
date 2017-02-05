var Promise = require("bluebird"),
	mongodb = Promise.promisifyAll(require('mongodb')),
	MongoClient = mongodb.MongoClient,
	Server = require('mongodb').Server,
	ObjectID = require('mongodb').ObjectID;

var MongoIndex = function(){
	return new Promise(function (resolve, reject) {
		MongoClient.connectAsync("mongodb://localhost:27017/searchDb").bind(this)
		.then(function(db){
			this.db = db;
			resolve(this);
		}).catch(function(err){
			reject(err);
		});
	}.bind(this));
};

MongoIndex.prototype.retrieve = function(){
	return new Promise(function (resolve, reject) {
		this.db.collectionAsync('reviews').bind(this).then(function(collection){
			return collection.findAsync();
		}).then(function(cursor){
			return cursor.toArrayAsync();
		}).then(function(allDocs){
			resolve(allDocs);
		}).catch(function(err){
			reject(err);
		});
	}.bind(this));
};


MongoIndex.prototype.retrieveDoc = function(id){
	return new Promise(function (resolve, reject) {
		this.db.collectionAsync('reviews').then(function(collection){
			return collection.findAsync({_id: ObjectID(id)});
		}).then(function(cursor){
			return cursor.toArrayAsync();
		}).then(function(allDocs){
			resolve(allDocs[0]);
		}).catch(function(err){
			reject(err);
		});
	}.bind(this));
};

MongoIndex.prototype.retrieveDocs = function(ids){
	return new Promise(function (resolve, reject) {
		ids = ids.map(function(id){
			return ObjectID(id);
		})
		this.db.collectionAsync('reviews').then(function(collection){
			return collection.findAsync({_id: {$in : ids}});
		}).then(function(cursor){
			return cursor.toArrayAsync();
		}).then(function(allDocs){
			resolve(allDocs);
		}).catch(function(err){
			reject(err);
		});
	}.bind(this));
};

module.exports = MongoIndex;
