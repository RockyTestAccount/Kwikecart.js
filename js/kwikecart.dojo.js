define(['dojo/_base/lang', 'dojo/query','dojo/_base/array', 'dojo/cookie', 'dojo/on', 
	'dojo/request', 'dojo/dom-form', 'dojo/io-query', 'dojo/ready'], 
function(lang, query, arr, cookie, on, request, domForm, ioQuery, ready) {
	'use strict';	
	var Cart = function (options) {	
		this.currentTotal = 0; 
		this.items = [];
		this.options = {
			expires: 1, // Cookie expiration
			taxMultiplier: 0.06,
			currency: 'USD',
            // Toggle to pass all form data on each call
            sendAll: false,
			// Define data that will be sent with all form posts
            attachFields: [
                /*
                    {name: 'firstName', value: 'MoreOutput'}
                */
            ],
			// Names of related DOM Data
			productNode: '.product',
			cartItems: '.cart-products',
			cartTotal: '.cart-total',
			idField: '[name=id]',
			priceField: '[name=price]',
			nameField: '[name=name]',
			quantityField: '[name=quantity]',
			// Forms that control the server calls
			addForm: '[name=itemadd]',
			removeForm: '[name=itemremove]',
			checkForm: '[name=itemcheck]',
			clearForm: '[name=clearcart]',
			totalForm: '[name=totalcart]',
			checkoutForm: '[name=checkout]',
			/* 
                XHR Action Override; will result in client side action being taken only. 
                Define as a url string to override the form action. Field values will be appended.
            */ 
			addAction: true,
			checkoutAction: true,
			removeAction: true,
			clearAction: true,
			totalAction: true,
			// Before events -- must return true before an item is added
			beforeCheck: null,
			beforeRemove: null,
			beforeClear: null,
			beforeCheckout: null,
			beforeAdd: null,
			beforeTotal: null,
			// On events -- Fire after the item is added and server response received
			onCheck: null,
			onRemove: null,
			onClear: null,
			onCheckout: null,
			onAdd: null,
			onDecrement: null, // Fired when an items quantity goes down but not to 0
			onIncrement: null, // Fired when an items quantity goes up but not on 1
			onTotal: null,
			xhrObj: {handleAs: 'json'}
		};

		return this;
	}

	Cart.prototype.create = function (options) {		
		var cart = this;

		cart.options = lang.mixin(cart.options, options);

		if (typeof cookie('nacart') !== 'undefined' && cart.options.expires !== -1) {
            cart.setupCartFromCookies();
		}

		if (cart.options.expires <= -1) {
            cookie('nacart', null, {expires: -1});
		}

		arr.forEach(query(cart.options.productNode), function(item, i) {
            var addEvt = on(query('#' + item.id + ' ' + cart.options.addForm)[0], 'submit', function(evt) {
 				evt.stopPropagation();
            	evt.preventDefault();
		        
            	cart.add(item);
			}),
			removeEvt = on(query('#' + item.id + ' ' + cart.options.removeForm)[0], 'submit', function(evt) {
 				evt.stopPropagation();
            	evt.preventDefault();

            	cart.remove(item);
			});
		});
        
        return cart;
	};

	Cart.prototype.setupCartFromCookies = function (callback) {
		var cart = this;	

		if (cookie('nacart') !== 'null' && cart.options.expires !== -1) {
			arr.forEach(JSON.parse(cookie('nacart')), function(item, i) {
				cart.add(item, item.quantity);
			});
		} else {
			cart.items = [];
		}	

		if (typeof callback === 'function') {
			callback();
		} 
	}; 	

	Cart.prototype.createItemObj = function (itemData, callback) {
		var cart = this,
		itemObj;

		if (typeof itemData === 'string') {
			itemData = query('#' + itemData);
		} else if (itemData.length === undefined) {
			itemData = query('#' + itemData.id);
		}

		itemObj = {
			id: itemData.query(cart.options.idField)[0].value,
			name: itemData.query(cart.options.nameField)[0].value,
			quantity: parseInt(itemData.query(cart.options.quantityField)[0].value),
			price: parseFloat(itemData.query(cart.options.priceField)[0].value)
		};

		if (typeof callback !== 'function') {
			return itemObj;
		} else {
			return callback(itemObj);
		}
	};

	Cart.prototype.set = function(items, quantity, callback) {
		var cart = this,
		tmpQuantity;
	
		if (typeof items === 'string' || (typeof items === 'object' && !items.length)) {
			items = [cart.createItemObj(items)];
		} else {
			arr.forEach(items, function(item, i) {
				items[i] = cart.createItemObj(item);
			});
		}

		arr.forEach(items, function(item, i)  {
			cart.find(item.id, function (fndItem, fndIndex) {
				if (fndItem === null) {
					if (quantity && quantity >= 1) {
						item.quantity = quantity;
					} else if (quantity === -1) {
						item.quantity += 1;
					}

					cart.items.push(item);
				} else {
					item = fndItem;
					tmpQuantity = item.quantity;

					if (quantity === -1) {
						item.quantity += 1;
					} else if (quantity === -2) {
						item.quantity = 0;
					} else {
						item.quantity += quantity;
					}
				}

				if (item.quantity <= 0) {
					cart.items.splice(fndIndex, 1);
				} else if (item.quantity > tmpQuantity && typeof cart.options.onIncrement === 'function') {
					cart.options.onIncrement(item);
				} else if (item.quantity < tmpQuantity && typeof cart.options.onDecrement === 'function') {
					cart.options.onDecrement(item);
				}

				if (cookie('nacart')) {
					cookie('nacart', null, {expires: -1});
				}			

				cookie('nacart', JSON.stringify(cart.items), 
					{expires: cart.options.expires});

				query('#' + item.id).query(cart.options.quantityField)[0].value = item.quantity;

				callback(item, true);
			});
		});

		return cart;
	}	

	Cart.prototype.add = function (items, quantity, callback) {		
		var cart = this,
		add = true;
 
		if (typeof cart.options.beforeAdd === 'function') {
	   		add = cart.options.beforeAdd(items, quantity);
		}

		if (add === true) {
			if (items.quantity >= 0) {
				quantity = items.quantity;
			} else if (typeof quantity === 'function') {
				callback = quantity;
				quantity = -1;
			} else if (!quantity || quantity <= 0) {
				quantity = -1;
			}

			cart.set(items, quantity, function(item, increment) {
				var addedFields = ioQuery.objectToQuery(cart.options.attachFields);

				if (addedFields.length > 0) {
					addedFields = '&' + addedFields;
				}

				if (cart.options.addAction) {
					cart.options.xhrObj.data = domForm.toObject(query('#' + item.id).query(cart.options.addForm)[0]);
		      		request.post(query(cart.options.addForm)[0].action + '?' + ioQuery.objectToQuery(cart.options.xhrObj.data) 
		      			+ '&increment=' + increment + addedFields, cart.options.xhrObj).then(function(r) {
		      			if (typeof cart.options.onAdd === 'function') {
							if (typeof callback !== 'function') {
   								cart.options.onAdd(item, quantity, r);
   							} else {
   								cart.options.onAdd(item, quantity, r);
   								callback(item, quantity, rv);
   							}
						}
						cart.total();
					});
		      	} else {
		      		cart.total();
		      		
		      		if (typeof callback === 'function') {
						callback(items, quantity, null);
					}
		      	}
			});
		}

		return cart;
	};

	Cart.prototype.find = function (id, callback) {
		var cart = this,
		fndItem = null,
		fndIndex = -1;

		if (cart.items.length !== 0) {
			arr.forEach(cart.items, function (item, i) {
				if (id === item.id) {
					fndItem = item;
					fndIndex = i;		
				}
			});	

			if (typeof callback === 'function') {
				return callback(fndItem, fndIndex);
			} else {
				return fndItem;
			}
		} else {
			if (typeof callback === 'function') {
				return callback(fndItem, fndIndex);
			} else {
				return fndItem;
			}
		}
	};		

	Cart.prototype.remove = function (items, quantity, callback) {
		var cart = this,
		remove = true;

		if (arguments.length > 0) {
			if (typeof cart.options.beforeRemove === 'function') {
		   		remove = cart.options.beforeRemove(items, quantity);
			}

			if (remove === true) { 
				if (quantity > 0) {
					quantity = -Math.abs(quantity);
				} else if (typeof quantity === 'function') {
					callback = quantity;
					quantity = -2;
				} else if (!quantity) {
					quantity = -2;
				}

				cart.set(items, quantity, function(item, decrement) {
					if (cart.options.removeAction) {
						cart.options.xhrObj.data = domForm.toObject(query('#' + item.id).query(cart.options.removeForm)[0]);

			      		request.post(query(cart.options.removeForm)[0].action + '?' + ioQuery.objectToQuery(cart.options.xhrObj.data) 
			      			+ '&decrement=' + decrement, cart.options.xhrObj).then(function(r) {
			      			if (typeof cart.options.onRemove === 'function') {
								if (typeof callback !== 'function') {
	   								cart.options.onRemove(item, quantity, r);
	   							} else {
	   								cart.options.onRemove(item, r);
	   								callback(item, quantity, r);
	   							}
							}
							cart.total();
						});
			      	} else {
			      		cart.total();
			      		
			      		if (typeof callback === 'function') {
							callback(items, quantity, null);
						}
			      	}
				});
			}
		} else {
			cart.clear();
		}

		return cart;
	};

	Cart.prototype.clear = function(clearCookies) {
		var cart = this,
		clear = true;

		if (typeof cart.options.beforeClear === 'function') {
	   		clear = cart.options.beforeClear(items, quantity);
		}

		if (clear === true) {
			cart.currentTotal = 0;
			cart.items = [];

			if (cart.options.clearAction === true) {
				request.post(query(cart.options.clearForm)[0].action, cart.options.xhrObj).then(function(r) {
					if (typeof cart.options.onClear === 'function') {
						if (typeof callback !== 'function') {
								cart.options.onClear(clearCookies, r);
							} else {
								callback(item, r);
							}
					}
					cart.total();
				});
		    } else {
		    	cart.total();

		    	if (typeof callback === 'function') {
					callback(false);
				}
		    }

		    cookie('nacart', null, {expires: -1});
		}
	};

	Cart.prototype.check = function (itemID, callback) {
		var check = true,
		cart = this;

		if (typeof cart.options.beforeCheck === 'function') {
	   		check = cart.options.beforeCheck(items, quantity);
		}

		if (check) {
			cart.find(itemID, function (fndItem, fndIndex) {
				if (fndItem) {
					cart.options.xhrObj.data = domForm.toObject(query('#' + fndItem.id).query(cart.options.addForm)[0]) 
                    +  domForm.toObject(query(cart.options.checkForm)[0]);
					
					request.post(query(cart.options.checkForm)[0].action, cart.options.xhrObj).then(function(r) {
						if (typeof cart.options.onCheck === 'function') {
							if (typeof callback !== 'function') {
								cart.options.onCheck(itemID, r);
							} else {
								callback(itemID, r);
							}
						}
					});
				}
			});
		} else if (!check && typeof callback === 'function') {
			callback(check);
		}
	};

	Cart.prototype.total = function (callServer, callback) {
		var total = true,
		cart = this;

		if (typeof cart.options.beforeTotal === 'function') {
	   		total = cart.options.beforeTotal(items, quantity);
		}

		if (total) {
			cart.items.forEach(function (item, i) {
				cart.currentTotal+= parseFloat(item.price * item.quantity).toFixed(2);	
			});

			if (cart.options.totalAction === true && callServer === true) {
				request.post(query(cart.options.totalForm)[0].action, cart.options.xhrObj).then(function(r) {
					if (typeof cart.options.onTotal === 'function') {
						if (typeof callback !== 'function') {
							cart.options.onTotal(callServer, r);
						} else {
							callback(callServer, r);
						}
					}
				});
		    } else if (typeof callback === 'function') {
		    	callback(cart.currentTotal);
		    }
		}
	};

	Cart.prototype.checkout = function (callServer, callback) {
		var cart = this,
		checkout = true;
	};
	
	return new Cart();
});
