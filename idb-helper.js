// IndexedDB helper minimalista para openDB e idb.set/all
// Salve este arquivo como public/idb-helper.js

(function(window){
	if (window.openDB && window.idb) return;

	function promisifyRequest(request) {
		return new Promise(function(resolve, reject) {
			request.onsuccess = function() { resolve(request.result); };
			request.onerror = function() { reject(request.error); };
		});
	}

	window.openDB = function() {
		return new Promise(function(resolve, reject) {
			var request = indexedDB.open('guarana-db', 1);
			request.onupgradeneeded = function(e) {
				var db = e.target.result;
				if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'id' });
				if (!db.objectStoreNames.contains('customers')) db.createObjectStore('customers', { keyPath: 'id' });
				if (!db.objectStoreNames.contains('sales')) db.createObjectStore('sales', { keyPath: 'id' });
			};
			request.onsuccess = function(e) { resolve(e.target.result); };
			request.onerror = function(e) { reject(request.error); };
		});
	};

	window.idb = {
		set: function(store, value) {
			return window.openDB().then(function(db) {
				return new Promise(function(resolve, reject) {
					var tx = db.transaction([store], 'readwrite');
					var req = tx.objectStore(store).put(value);
					req.onsuccess = function() { resolve(value); };
					req.onerror = function(e) { reject(req.error); };
				});
			});
		},
		all: function(store) {
			return window.openDB().then(function(db) {
				return new Promise(function(resolve, reject) {
					var tx = db.transaction([store], 'readonly');
					var req = tx.objectStore(store).getAll();
					req.onsuccess = function() { resolve(req.result); };
					req.onerror = function(e) { reject(req.error); };
				});
			});
		}
	};
})(window);
