A simple demo that exposes two APIs to perform query search over a dataset. Data is first populated into a Mongo collection for easy retrieval(Mongo is purely being used to save and retrieve the whole data instead of reading a large text file into memory). Then the two end points below can be used to perform queries.

Steps to setup

- Install and run mongodb (https://docs.mongodb.com/manual/tutorial/install-mongodb-on-os-x/)
- Install and run latest version of node (https://github.com/tj/n or https://gist.github.com/isaacs/579814)
- Initial data setup is done through the script db/insertData.js (``` node insertData.js > out.log ```)
- Install node dependencies via ``` npm install ```
- Start the local server via ``` npm start ```




URL - /search/?q
- RESTful GET API to fetch top 20 documents from the dataset through brute force search.
- Response header 'X-Response-Time' denotes the time taken by the API
- Example
```
$ curl -s -D - 'http://localhost:3000/search/?q=different%20terms' -o ./out-brute.txt
```





URL - /searchTrie/?q
- RESTful GET API to fetch top 20 documents from the dataset through search implemented an a Trie data structure.
- The Trie is built during application init. All the tokens in the dataset are inserted into the trie while also saving the list of indexes of documents which contain the tokens. This is a variation of the conventional trie. At the edge of a node, an array of indexes of all documents containing the Key are saved. For retrieval, the list of ids at the end of each term are fetched from the Trie and the corresponding documents from MongoDB are then scored and returned.
- Response header 'X-Response-Time' denotes the time taken by the API
- Example
```
$ curl -s -D - 'http://localhost:3000/searchTrie/?q=different%20terms' -o ./out-trie.txt
```




TODO
-UI to compare the search APIs
-Load testing with a sample set
