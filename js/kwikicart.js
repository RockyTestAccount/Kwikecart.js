/* Rocky Bevins moreoutput@gmail.com, v0.0.5 */
define(['dojo/_base/lang', 'dojo/dom', 'dojo/dom-construct', 'dojo/query', 
	'dojo/_base/array', 'dojo/cookie', 'dojo/dom-class', 'dojo/on', 
	'dojo/_base/event', 'dojo/request', 'dojo/dom-form', 'dojo/io-query', 'dojo/ready'], 
function(lang, dom, domC, query, arr, cookie, domClass, on, evt, request, domForm, ioQuery, ready) {
	'use strict';	
	var Cart = function (options) {	
		this.currentTotal = 0; // This is set when total() is called
		this.items = [];
		this.options = {
			expires: 1, // Cookie expiration
			taxMultiplier: 0.06,
			currency: 'USD',
			attachFieldIDs: false,
			// Related DOM Data
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
			// XHR Action Override; will result in client side action being taken only
			addAction: true,
			checkoutAction: true,
			removeAction: true,
			clearAction: true,
			totalAction: true,
			incrementAction: true, 
			decrementAction: true,
			// Before events -- must return true before an item is added
			beforeCheck: null,
			beforeRemove: null,
			beforeClear: null,
			beforeCheckout: null,
			beforeAdd: null,
			beforeDecrement: null,
			beforeIncrement: null,
			beforeTotal: null,
			// On events -- Fire after the item is added and server response received
			onCheck: null,
			onRemove: null,
			onClear: null,
			onCheckout: null,
			onAdd: null,
			onDecrement: null,
			onIncrement: null,
			onTotal: null,
			xhrObj: {handleAs: 'json'}
		};

		return this;
	}

	Cart.prototype.create = function (options) {		
		var cart = this;

		cart.options = lang.mixin(cart.options, options);

		if (typeof cookie('nacart') !== 'undefined') {
			cart.setupCartFromCookies();
		}			

		arr.forEach(query(cart.options.productNode), function(item) {
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

	// Outlines cart items from cookie information
	Cart.prototype.setupCartFromCookies = function (callback) {
		var cart = this;	

		if (cookie('nacart') !== 'null') {
			cart.items = JSON.parse(cookie('nacart'));
		} else {
			cart.items = [];
		}	

		if (typeof callback === 'function') {
			callback();
		} 
	}; 	

	// Turn non obj item references to item objects based on dom data
	Cart.prototype.createItemObj = function (itemData) {
		var cart = this;
		return {
			id: (function() {
				if (!itemData.id) {
					return query(itemData).query(cart.options.idField)[0].value;
				} else {
					return itemData.id;
				}
			}()),
			name: (function() {
				if (!itemData.name) {
					return query(itemData).query(cart.options.nameField)[0].value;
				} else {
					return itemData.name;
				}
			}()),
			quantity: (function() {
				if (!itemData.quantity) {
					return 1;
				} else {
					return itemData.quantity;
				}
			}()),
			price: (function() {
				if (!itemData.price) {
					return parseFloat(query(itemData).query(cart.options.priceField)[0].value);
				} else {
					return parseFloat(itemData.price);
				}
			}())
		};
	};

	Cart.prototype.add = function (items, quantity, callback) {		
		var cart = this,
		i = 0,
		add = true;

		if (!quantity || quantity <= 0) {
			quantity = -1;
		} else if (typeof quantity === 'function') {
			callback = quantity;
			quantity = -1;
		} 

		if (typeof items === 'string' || (typeof items === 'object' && !items.length)) {
			items = [cart.createItemObj(items)];
		} else {
			arr.forEach(items, function(item, i) {
				items[i] = cart.createItemObj(item);
			});
		}

		if (typeof cart.options.beforeAdd === 'function') {
	   		add = cart.options.beforeAdd(items, quantity);
		}

		if (add === true) {
			arr.forEach(items, function(item, i)  {
				cart.isInCart(item.id, function (fnd) {
					var	increment = cart.options.incrementAction;	

					if (!fnd) {
						if (quantity && quantity > 1) {
							item.quantity = quantity;
						} else if (quantity === -1) {
							quantity = item.quantity;
						}
					} else {
						cart.items.forEach(function (item2) {
							if (typeof cart.options.onIncrement === 'function') {
	   							increment = cart.options.onIncrement();
							}					
							
							if (item2.id === item.id && increment) {
								item = item2;
								if (quantity === -1) {
									quantity = 1;
									item.quantity = item.quantity + quantity;
								} else {
									item.quantity = quantity;
								}
							}
						});	
					}

					query('#' + item.id).query(cart.options.quantityField)[0].value = quantity;

					if (cart.options.addAction) {
						cart.options.xhrObj.data = domForm.toObject(query('#' + item.id).query(cart.options.addForm)[0]);

			      		request.post(query(cart.options.addForm)[0].action + '?' + ioQuery.objectToQuery(cart.options.xhrObj.data) + '&quantity=' + item.quantity + '&increment=' + quantity, cart.options.xhrObj ).then(function(r) {
			      			if (typeof cart.options.onAdd === 'function') {
								if (typeof callback !== 'function') {
	   								cart.options.onAdd(item, r);
	   							} else {
	   								callback(item, r);
	   							}
							}
							cart.total();
						});
			      	} else {
			      		cart.total();
			      		callback(item, null);
			      	}
				
					if (cookie('nacart')) {
						cookie('nacart', null, {expires: -1});
					}			

					cookie('nacart', JSON.stringify(cart.items), 
						{expires: cart.options.expires});
				});
			});
		}

		return cart;
	};

	Cart.prototype.isInCart = function (id, callback) {
		var cart = this;
		if (cart.items.length !== 0) {
			arr.forEach(cart.items, function (item, i) {
				if (id === item.id) {
					return callback(true, item);
				}

				if (i === cart.items.length - 1) {
					return callback(false, null);
				}
			});	
		} else {
			return callback(false, null);
		}
	};		

	Cart.prototype.remove = function (items, amountToRemove, callback) {
		var cart = this,
		remove = true;

		if (typeof cart.options.onRemove === 'function') {
	   		remove = cart.options.onRemove();
		}

		if (remove === true) {
			if (arguments.length > 0 && (items.id !== undefined && typeof items === 'object')) {
				if (items.length === undefined) {
					items = [items];
				}

				arr.forEach(items, function(item, i)  {
					arr.forEach(cart.items, function (item2, j) {
						if (item2.id === item.id) {
							cart.items.splice(j, 1);	

							if (cart.items.length > 0) {
								cookie('nacart', JSON.stringify(cart.items), 
									{expires: cart.options.expires});
							} else {
								cookie('nacart', null, {expires: -1});
							}

						}
					});			
				
					cart.checkItemDOM(item.id, function (fnd) {
						if (fnd) {
							domC.destroy(query(cart.options.cartItems + ' .' + item.id)[0]);	
						}
					});		
				});


				if (cart.options.removeAction === true) {
					if (!amountToRemove || amountToRemove <= 0) {
						request.post(query(cart.options.removeForm)[0].action + '?' + ioQuery.objectToQuery(cart.options.xhrObj.data), cart.options.xhrObj).then(function(r) {
							// console.log(r);
						});
					} else {
						request.post(query(cart.options.removeForm)[0].action + '?' + ioQuery.objectToQuery(cart.options.xhrObj.data) 
							+ '&decrement=' + amountToRemove, cart.options.xhrObj).then(function(r) {
							// console.log(r);
						});
					}
			    }
			} else {
				// Clear Action
				cart.items.forEach(function (item, j) {
					domC.destroy(query(cart.options.cartItems + ' .' + item.id)[0]);
				});

				cart.items = [];
				cookie('nacart', null, {expires: -1});

				if (cart.options.removeAction === true) {
					request.get(query(cart.options.clearForm)[0].action, cart.options.xhrObj).then(function(r) {
						// console.log(r);
					});
			    }
			}
		}
	};

	// totals the cart
	Cart.prototype.total = function () {
		var total = 0,
		cart = this;

		this.items.forEach(function (item, i) {
			total = total + parseFloat(item.price * item.quantity);
			cart.currentTotal = total;		
		});
		
		dom.byId('total').value = total;
		
		this.cartTotal = total;

		return cart;
	};
	
	return new Cart();
});