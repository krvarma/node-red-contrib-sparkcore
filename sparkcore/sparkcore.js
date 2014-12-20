var EventSource = require('eventsource');
var Request = require("request");
var querystring = require('querystring');

module.exports = function(RED) {
	// Node-RED Input Module
    function SparkCoreIN(n) {
		var sparkmodule = null;
	
        RED.nodes.createNode(this,n);
		
		sparkmodule = this;
		
		// Get all properties
        this.interval_id = null;
		this.repeat = n.repeat * 1000;
		this.name = n.fve;
		this.param = n.param;
		this.method = n.method;
		this.baseurl = n.baseurl;
		
		// Check base URL or default to Spark Cloud URL.
		if(this.baseurl === null || this.baseurl === ''){
			this.baseurl = "https://api.spark.io";
		}
		
		console.log("Using base URL: " + this.baseurl);
		
		// Get all credentials
		var credentials = RED.nodes.getCredentials(n.id);
		
		// Check access token
		if ((credentials) && (credentials.hasOwnProperty("accesstoken"))) { 
			this.access_token = credentials.accesstoken; 
		}
        else { 
			this.error("No Spark Core access token set"); 
		}
        
		// Check core id
		if ((credentials) && (credentials.hasOwnProperty("coreid"))) { 
			this.core_id = credentials.coreid; 
		}
        else { 
			this.error("No Spark Core device id set"); 
		}
		
		setTimeout( function(){ sparkmodule.emit("process",{}); }, 100);
		
		// Called when there an input
		this.on("input", function(msg){
			// Retrieve all parameters from Message
			var val = msg.name;
			
			console.log(msg);
			
			// Retrieve name
			if(val && val.length > 0){
				this.name = val;
			}
			
			val = msg.payload;
			
			// Retrieve payload
			if(val && val.length > 0){
				this.param = val;
			}
			
			val = msg.operation;
			
			// Retrieve Operation
			if(val && val.length > 0){
				this.method = val;
			}
			
			val = msg.baseurl;
			
			// Retrieve Base URL
			if(val && val.length > 0){
				this.baseurl = val;
			}
			
			console.log("Operation: " + this.method);
			console.log("Name: " + this.name);
			console.log("Parameter: " + this.param);
			
			setTimeout( function(){ sparkmodule.emit("process",{}); }, 100);
		});
		
		// Perform operations based on the method parameter.
		this.on("process", function(){
			// Function
			if(this.method == "function"){
				// Check for repeat and start timer
				if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
					console.log("Repeat = "+this.repeat);
					
					this.interval_id = setInterval( function() {
						sparkmodule.emit("callfunction",{});
					}, this.repeat );
				} 
				// There is no repeat, just start once
				else if (this.name && this.name.length > 0){
					setTimeout( function(){ sparkmodule.emit("callfunction",{}); }, 100);
				}
			}
			// Event Subscription
			else if(this.method == "subscribe"){
				var url = this.baseurl + "/v1/devices/" + this.core_id + "/events/" + this.name + "?access_token=" + this.access_token;
				
				this.es = new EventSource(url);
				
				console.log(url);
			
				// Add Event Listener
				this.es.addEventListener(this.name, function(e){
					var data = JSON.parse(e.data);
				
					var msg = {
						raw: data,
						payload:data.data,
						published_at: data.published_at,
						id: data.coreid
					};
				
					sparkmodule.send(msg);
				}, false);

				this.es.onerror = function(){
					console.log('ES Error');
				};
			}
			// Read variable
			else if(this.method == "variable"){
				// Check for repeat and start timer
				if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
					console.log("Repeat = "+this.repeat);
					
					this.interval_id = setInterval( function() {
						sparkmodule.emit("getvariable",{});
					}, this.repeat );
				} 
				// There is no repeat, just start once
				else if (this.name && this.name.length > 0){
					setTimeout( function(){ sparkmodule.emit("getvariable",{}); }, 100);
				}
			}
		});
		
		// Call Spark Core function
		this.on("callfunction", function(){
			var url = this.baseurl + "/v1/devices/" + this.core_id + "/" + this.name;
			
			console.log("Calling function...");
			
			console.log("URL: " + this.baseurl);
			console.log("Core ID: " + this.core_id);
			console.log("Function Name: " + this.name);
			console.log("Parameter: " + this.param);
			
			// Call Spark Core function
			Request.post(
				url, 
				{
					form: {
						access_token: this.access_token,
						args: this.param
					}
				},
				function (error, response, body){
					console.log(body);
					// If not error then prepare message and send
					if(!error && response.statusCode == 200){
						var data = JSON.parse(body);
						var msg = {
							raw: data,
							payload: data.return_value,
							id: data.id
						};

						console.log(data);
						
						sparkmodule.send(msg);
					}
				}
			);
		});
		
		// Read Spark Core variable
		this.on("getvariable", function(){
			var url = this.baseurl + "/v1/devices/" + this.core_id + "/" + this.name + "?access_token=" + this.access_token;
			
			console.log("Reading variable '" + this.name + "'");
			console.log("URL '" + url + "'");
			
			// Read Spark Core variable
			Request.get(url,
				function (error, response, body){
					console.log(body);
					
					// If not error then prepare message and send
					if(!error && response.statusCode == 200){
						var data = JSON.parse(body);
						
						var msg = {
							raw: data,
							payload: data.result,
							id: data.coreInfo.deviceID
						};

						sparkmodule.send(msg);
					}
				}
			);
		});
    }
	
	// Node-RED Output variable
	function SparkCoreOUT(n) {
		var sparkmodule;
		
        RED.nodes.createNode(this,n);
		
		sparkmodule = this;
		
		this.name = n.fve;
		this.param = n.param;
		this.baseurl = n.baseurl;
		
		// Check base URL or default to Spark Cloud URL.
		if(this.baseurl === null || this.baseurl === ''){
			this.baseurl = "https://api.spark.io";
		}
		
		console.log("Using base URL: " + this.baseurl);
		
		// Get all credentials
		var credentials = RED.nodes.getCredentials(n.id);
		
		// Check access token
		if ((credentials) && (credentials.hasOwnProperty("accesstoken"))) { 
			this.access_token = credentials.accesstoken; 
		}
        else { 
			this.error("No Spark Core access token set"); 
		}
        
		// Check Core ID
		if ((credentials) && (credentials.hasOwnProperty("coreid"))) { 
			this.core_id = credentials.coreid; 
		}
        else { 
			this.error("No Spark Core device id set"); 
		}
		
		this.on("input", function(msg){
			var val = msg.name;
			
			console.log(msg);
			
			// Retrieve name
			if(val && val.length > 0){
				this.name = val;
			}
			
			val = msg.payload;
			
			// Retrieve payload
			if(val && val.length > 0){
				this.param = val;
			}
			
			val = msg.baseurl;
			
			// Retrieve Base URL
			if(val && val.length > 0){
				this.baseurl = val;
			}
			
			var url = this.baseurl + "/v1/devices/" + this.core_id + "/" + this.name;
			var parameter = this.param;
			
			if(parameter.length == 0){
				parameter = msg.payload;
			}
			
			// Prepare Post Data
			var postdata = {
				form: {
					access_token: this.access_token,
					args: parameter
				}
			};
			
			console.log("[OUT]: Calling function...");
			console.log("[OUT]: " + this.core_id);
			console.log("[OUT]: " + this.name);
				
			// Call Spark Core function
			Request.post(
				url, 
				postdata,
				function (error, response, body){
					// If not error, send to Node-RED
					if(!error && response.statusCode == 200){
						var data = JSON.parse(body);
						
						console.log(data);
						
						var msg = {
							raw: data,
							payload: data.return_value,
							id: data.id,
							name: data.name
						};

						sparkmodule.send(msg);
					}
				}
			);
		});
    }
	
    RED.nodes.registerType("SparkCore in",SparkCoreIN);
	RED.nodes.registerType("SparkCore out",SparkCoreOUT);
	
	SparkCoreIN.prototype.close = function() {
        if (this.interval_id != null) {
			console.log("Interval closed.");
            clearInterval(this.interval_id);
        }
		
		if(this.es != null){
			console.log("EventSource closed.");
			this.es.close();
		}
    }
	
	RED.httpAdmin.get('/sparkcore/:id',function(req,res) {
		var credentials = RED.nodes.getCredentials(req.params.id);

		if (credentials) {
			res.send(JSON.stringify({coreid:credentials.coreid,accesstoken:credentials.accesstoken}));
		} else {
			res.send(JSON.stringify({}));
		}
	});

	RED.httpAdmin.delete('/sparkcore/:id',function(req,res) {
		RED.nodes.deleteCredentials(req.params.id);
		res.send(200);
	});

	RED.httpAdmin.post('/sparkcore/:id',function(req,res) {
		var body = "";
		req.on('data', function(chunk) {
			body+=chunk;
		});
		
		req.on('end', function(){
			var newCreds = querystring.parse(body);
			var credentials = RED.nodes.getCredentials(req.params.id)||{};
			if (newCreds.coreid === null || newCreds.coreid === "") {
				delete credentials.coreid;
			} else {
				credentials.coreid = newCreds.coreid;
			}
			if (newCreds.accesstoken === "") {
				delete credentials.accesstoken;
			} else {
				credentials.accesstoken = newCreds.accesstoken||credentials.accesstoken;
			}
			RED.nodes.addCredentials(req.params.id,credentials);
			res.send(200);
		});
	});
}