// constant data for authentication
var auth_url = 'http://api.rememberthemilk.com/services/auth/';
var req_url = 'http://api.rememberthemilk.com/services/rest/';
var api_key  = '46f829c619762a0f73e8ccda88dc00e3';
var shared_secret = '001d7cf1f33f985d';

// currently loaded options
var frob;
var token;
var user_id;
var user_username;
var user_fullname;

// default filter
var filter = 'status:incomplete';

// loads data in localStorage
function loadData() {
	frob = localStorage['frob'];
	token = localStorage['token'];
	user_id = localStorage['user_id'];
	user_username = localStorage['user_username'];
	user_fullname = localStorage['user_fullname'];
}

// save data to localStorage
function saveData() {
	localStorage['frob'] = frob;
	localStorage['token'] = token;
	localStorage['user_id'] = user_id;
	localStorage['user_username'] = user_username;
	localStorage['user_fullname'] = user_fullname;
}

// erases data from localStorage
function eraseData() {
	localStorage.removeItem('frob');
	localStorage.removeItem('token');
	localStorage.removeItem('user_id');
	localStorage.removeItem('user_username');
	localStorage.removeItem('user_fullname');
}

/**
 * Calls the RTM REST API.
 * params: an object with parameters to send. API key, JSON format and token are added.
 * callback: a function(rsp) where the response will be sent.
 */
function rtmCall(params, callback) {
	params.format = 'json';
	params.api_key = api_key;
	if (token != 'undefined') params.auth_token = token;
	
	// special param to ignore cache
	params.ms = new Date().getTime();
	
	rtmSign(params);
	
	$.getJSON(
		req_url, 
		params,
		function(data) {
			callback(data.rsp);
		}
	);
}

/**
 * Queries a frob from the RTM API.
 * successCallback: a function(frob) where the frob will be sent.
 * failCallback:    a function(rsp) where the failed response will be sent.
 */
function rtmGetFrob(successCallback, failCallback) {
	loadData();

	// if there is no frob, request one
	if (frob == 'undefined' || typeof(frob) == 'undefined') {
		console.log('getting new frob');
		var params = {
			method: "rtm.auth.getFrob"
		}
		
		rtmCall(params, function(rsp) {
			if (rsp.stat == 'fail') {
				failCallback(rsp);
			}
			else {
				frob = rsp.frob;
				saveData();
				console.log('frob: ' + frob);
				successCallback(frob);
			}
		});
	}
	else {
		console.log('using existing frob: ' + frob);
		successCallback(frob);
	}
}

/**
 * Creates an authentication URL for ChromeMilk
 * successCallback: a function(url) where the created URL will be sent.
 * failCallback:    a function(rsp) where the failed response will be sent.
 */
function rtmShowAuth(successCallback, failCallback) {

	rtmGetFrob(
		function(frob) {
			var params = {
				api_key: api_key,
				frob: frob,
				perms: 'read'
			};
			rtmSign(params);
			
			var url = auth_url + 
			"?api_key=" + params.api_key + 
			"&frob=" + params.frob + 
			"&perms=" + params.perms + 
			"&api_sig=" + params.api_sig;
			
			//chrome.tabs.create({url: url});
			
			successCallback(url);
		},
		function(rsp) {
			failCallback(rsp);
		}
	);
}

/**
 * Aquires an authentication token
 * successCallback: a function() to call when token is aquired.
 * failCallback:    a function(rsp) where the failed response will be sent.
 */
function rtmGetToken(successCallback, failCallback) {
	loadData();

	if (token == 'undefined' || typeof(token) == 'undefined') {
		rtmGetFrob(
			function(frob) {
				var params = {
					method: 'rtm.auth.getToken',
					frob: frob
				};
				console.log('getting token');
				rtmCall(params, function(rsp) {
					if (rsp.stat == 'fail') {
						failCallback(rsp);
					}
					else {
						token = rsp.auth.token;
						console.log('token: ' + token);
						user_id = rsp.auth.user.id;
						user_username = rsp.auth.user.username;
						user_fullname = rsp.auth.user.fullname;
						saveData();
						successCallback();
					}
				});
			},
			function(rsp) {
				failCallback(rsp);
			}
		);
	}
	else {
		successCallback();
	}
}

/**
 * Signs a list of parameters to send to RTM
 */
function rtmSign(args) {
	var arr = [];
	var str = shared_secret;
	
	for (var e in args) {
		arr.push(e);
	}
	arr.sort();

	for (var i = 0; i < arr.length; i++) {
		str+=arr[i]+args[arr[i]];
	}
	var sig = String(MD5(str));

	args.api_sig = sig;
}

/**
 * Queries for the number of incomplete tasks
 * cus_filter:      a custom filter to use in conjunction with the default one
 * successCallback: a function(numTasks) to send the number of tasks to
 * failCallback:    a function(rsp) where the failed response will be sent
 */
function rtmIncompleteTasks(cus_filter, successCallback, failCallback) {
	rtmGetToken(
		function() {
			var params = {
				method: 'rtm.tasks.getList'
			};
			
			if (cus_filter != '') params.filter = filter + ' AND ' + cus_filter;
			else params.filter = filter;
			
			rtmCall(
				params, 
				function(rsp) {
					if (rsp.stat == 'fail') {
						failCallback(rsp);
					}
					else {
						var lists = rsp.tasks.list;
						var numTasks = 0;
						if (lists != undefined) {
							if (lists.constructor.toString().match(/array/i)) {
								for (var i in lists) {
									var series = lists[i].taskseries;
									if (series.constructor.toString().match(/array/i))
										numTasks += series.length;
									else
										numTasks += 1;
								}
							}
							else {
								var series = lists.taskseries;
								if (series.constructor.toString().match(/array/i))
									numTasks += series.length;
								else
									numTasks += 1;
							}
						}
						successCallback(numTasks);
					}
				}		
			);
		},
		function(rsp) {
			failCallback(rsp);
		}
	);
}


