
function Trie(parent, prev, key, value) {
	if (key !== void 0)
	this.key = key;      // single-character key
	if (value !== void 0)
	this.value = value;  // in 'value', store a list of indexes of all documents that contain this string
	if (prev)
	prev.next = this;    // next sibling node
	else if (parent)
	parent.child = this; // first child node
}

// put a key/value pair in the trie
Trie.prototype.put = function(name, value) {
	var i = 0, t = this, len = name.length, prev, parent;
	down: while (t.child) {
		parent = t;
		t = t.child;
		// if first child didn't match, get next sibling
		while (t.key != name[i]) {
			if (!t.next) {
				prev = t;
				t = parent;
				break down;
			}
			t = t.next;
		}
		// if key already exists, make the value an array and append the index
		if (++i > len) {
			if(typeof t.value === 'string'){
				t.value = [t.value];
			}
			t.value.push(value);
			return;
		}
	}
	// found any existing parts of the key, add the rest
	t = new this.constructor(t, prev, name[i]);
	while (++i <= len)
	t = new this.constructor(t, null, name[i]);
	t.name = name;
	t.value = value;
};

// get a value from the trie at the given key
Trie.prototype.get = function(name) {
	var i = 0, t = this.child, len = name.length;
	while (t) {
		if (t.key == name[i]) {
			if (i == len)
			return t.value;
			t = t.child;
			++i;
		} else {
			t = t.next;
		}
	}
};

module.exports = Trie;
