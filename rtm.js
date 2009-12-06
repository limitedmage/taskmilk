var auth_url = 'http://api.rememberthemilk.com/services/auth/';
var req_url = 'http://api.rememberthemilk.com/services/rest/';
var api_key  = '46f829c619762a0f73e8ccda88dc00e3';
var shared_secret = '001d7cf1f33f985d';

var frob;
var token;
var user_id;
var user_username;
var user_fullname;

var filter = 'status:incomplete';

function loadData() {
	frob = localStorage['frob'];
	token = localStorage['token'];
	user_id = localStorage['user_id'];
	user_username = localStorage['user_username'];
	user_fullname = localStorage['user_fullname'];
}

function saveData() {
	localStorage['frob'] = frob;
	localStorage['token'] = token;
	localStorage['user_id'] = user_id;
	localStorage['user_username'] = user_username;
	localStorage['user_fullname'] = user_fullname;
}

function eraseData() {
	localStorage['frob'] = undefined;
	localStorage['token'] = undefined;
	localStorage['user_id'] = undefined;
	localStorage['user_username'] = undefined;
	localStorage['user_fullname'] = undefined;
}

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

function rtmGetFrob(callback) {
	loadData();

	// if there is no frob, request one
	if (frob == 'undefined' || typeof(frob) == 'undefined') {
		console.log('getting new frob');
		var params = {
			method: "rtm.auth.getFrob"
		}
		
		rtmCall(params, function(rsp) {
			frob = rsp.frob;
			saveData();
			console.log('frob: ' + frob);
			callback(frob);
		});
	}
	else {
		console.log('using existing frob: ' + frob);
		callback(frob)
	}
}

function rtmShowAuth() {

	rtmGetFrob(function(frob) {
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
		
		chrome.tabs.create({url: url});
	});
}

function rtmGetToken(callback) {
	loadData();

	if (token == 'undefined' || typeof(token) == 'undefined') {
		rtmGetFrob(function(frob) {
			var params = {
				method: 'rtm.auth.getToken',
				frob: frob
			};
			console.log('getting token');
			rtmCall(params, function(rsp) {
				token = rsp.auth.token;
				console.log('token: ' + token);
				user_id = rsp.auth.user.id;
				user_username = rsp.auth.user.username;
				user_fullname = rsp.auth.user.fullname;
				saveData();
				callback();
			});
		});
	}
	else {
		callback();
	}
}

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

function rtmIncompleteTasks(cus_filter, callback) {
	rtmGetToken(function() {
		var params = {
			method: 'rtm.tasks.getList'
		};
		
		if (cus_filter != '') params.filter = filter + ' AND ' + cus_filter;
		else params.filter = filter;
		
		rtmCall(params, function(rsp) {
			var lists = rsp.tasks.list;
			var numTasks = 0;
			
			for (var i in lists) {
				var series = lists[i].taskseries;
				if (series.constructor.toString().match(/array/i))
					numTasks += lists[i].taskseries.length;
				else
					numTasks += 1;
			}
			
			callback(numTasks);
		});
	});
}
