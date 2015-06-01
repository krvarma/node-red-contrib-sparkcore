/*
  Copyright 2014 Krishnaraj Varma (node-red-contrib-sparkcore 0.0.12)
  Copyright 2015 Chuan Khoo (node-red-contrib-particle 0.0.1), including:
        local cloud SSE (limited) support
        renaming to Particle
        configuration node implementation

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

var EventSource = require('eventsource');
var Request = require("request");
var querystring = require('querystring');

module.exports = function(RED) {

	// Configuration module
    function ParticleCloudNode(n) {
        RED.nodes.createNode(this,n);
        this.host = n.host;
        this.port = n.port;
        this.name = n.name;

		if (this.credentials && this.credentials.hasOwnProperty("accesstoken") ) {
			this.accesstoken = this.credentials.accesstoken; 
		}

    }

    RED.nodes.registerType("particle-cloud",ParticleCloudNode, {
		credentials: {
			accesstoken: {type:"password"}
		}
 	});

	// Node-RED Input Module - base module for connecting to a Particle Cloud
    function ParticleIN(n) {
		var particlemodule = null;
	
        RED.nodes.createNode(this,n);
		
		particlemodule = this;

		// note: code here runs when flow is re-deployed. n object refers to a node's instance configuration and so is unique between nodes
		
		// Get all properties
		this.config = n;
        this.interval_id = null;
		this.repeat = n.repeat * 1000;
		this.name = n.fve;
		this.param = n.param;
		this.method = n.method;
		this.baseurl = RED.nodes.getNode(n.baseurl);
		this.timeoutDelay = 100;

		console.log("(Particle IN) local cloud: " + Object.keys(this.baseurl));
		console.log("(Particle IN) local cloud: " + this.baseurl.accesstoken);

		(this.baseurl.host === "https://api.particle.io") ? this.isLocal = false : this.isLocal = true;

		if(this.baseurl.accesstoken === null || this.baseurl.accesstoken === '') {
			this.status({fill:"red",shape:"dot",text:""});
			this.error("No Particle access token in configuration node");
		} else {
			this.status({});
		}
        
		// Check device id
		if((this.credentials) && (this.credentials.hasOwnProperty("devid"))) {
			this.dev_id = this.credentials.devid;
			this.status({});
		} else {
        	// no device id set; check if user has setup a local cloud
        	if(this.method !== "subscribe" && !this.isLocal) {
        		this.status({fill:"yellow",shape:"dot",text:""});
				this.error("No Particle Device ID set");
        	} else {
        		// ignore, due to partial local cloud SSE support (public firehose)
				this.dev_id = "";
        	}
		}
		
		setTimeout( function(){ particlemodule.emit("process",{}); }, 100);
		
		// Called when there an input from upstream node(s)
		this.on("input", function(msg){
			// Retrieve all parameters from Message
			var val = msg.name;
			
			// Retrieve name
			if(val && val.length > 0){
				this.name = val;
			}
			
			// Retrieve payload
			this.param = msg.payload;
						
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
			
			setTimeout( function(){ particlemodule.emit("process",{}); }, timeoutDelay);
		});
		
		// Perform operations based on the method parameter.
		this.on("process", function(){
			// Call Particle Function
			if(this.method == "function"){
				// Check for repeat and start timer
				if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
					console.log("(Particle IN) Repeat = "+this.repeat);
					
					this.interval_id = setInterval( function() {
						particlemodule.emit("callfunction",{});
					}, this.repeat );
				} 
				// There is no repeat, just start once
				else if (this.name && this.name.length > 0){
					setTimeout( function(){ particlemodule.emit("callfunction",{}); }, timeoutDelay);
				}
			}

			// SSE (Server-Sent-Event) Subscription
			else if(this.method == "subscribe"){
				// if we're dealing with a local cloud, or if device ID is empty, fallback to public/event firehose & ignore device ID
				var url;
				if(this.isLocal || !this.dev_id) {
					url = this.baseurl.host + ":" + this.baseurl.port + "/v1/events/" + this.name + "?access_token=" + this.baseurl.accesstoken;
				} else {
					url = this.baseurl.host + ":" + this.baseurl.port + "/v1/devices/" + this.dev_id + "/events/" + this.name + "?access_token=" + this.baseurl.accesstoken;
				}

				console.log("ES attempt to: " + url);
				this.es = new EventSource(url);
			
				// Add EventSource Listener
				this.es.addEventListener(this.name, function(e){
					var data = JSON.parse(e.data);
				
					var msg = {
						raw: data,
						payload:data.data,
						published_at: data.published_at,
						id: data.coreid						// TODO: currently spark-server still uses coreid as property name
					};
				
					particlemodule.send(msg);
				}, false);

				this.es.onopen = function(){
					particlemodule.status({fill:"green",shape:"dot",text:"SSE Connected"});
					console.log('(Particle IN) SSE Connected');
				};

				this.es.onerror = function(){
					particlemodule.status({fill:"red",shape:"ring",text:"SSE Error"});
					console.log('(Particle IN) SSE Error');
				};
			}

			// Read variable
			else if(this.method == "variable"){
				// Check for repeat and start timer
				if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
					
					this.interval_id = setInterval( function() {
						particlemodule.emit("getvariable",{});
					}, this.repeat );
				} 
				// There is no repeat, just start once
				else if (this.name && this.name.length > 0){
					setTimeout( function(){ particlemodule.emit("getvariable",{}); }, timeoutDelay);
				}
			}
		});
		
		// Call Particle Device function
		this.on("callfunction", function(){
			var url = this.baseurl + "/v1/devices/" + this.dev_id + "/" + this.name;
			
			console.log("(Particle IN) Calling function...");
			
			console.log("URL: " + this.baseurl);
			console.log("Device ID: " + this.dev_id);
			console.log("Function Name: " + this.name);
			console.log("Parameter: " + this.param);
			
			// Call Particle Device function
			Request.post(
				url, 
				{
					form: {
						access_token: this.access_token,
						args: this.param
					}
				},
				function (error, response, body){
					// If not error then prepare message and send
					if(!error && response.statusCode == 200){
						var data = JSON.parse(body);
						var msg = {
							raw: data,
							payload: data.return_value,
							id: data.id
						};
						
						particlemodule.send(msg);
					}
				}
			);
		});
		
		// Read Particle Device variable
		this.on("getvariable", function(){
			var url = this.baseurl + "/v1/devices/" + this.dev_id + "/" + this.name + "?access_token=" + this.access_token;
			
			console.log("(Particle IN) Reading variable '" + this.name + "'");
			console.log("URL '" + url + "'");
			
			// Read Particle device variable
			Request.get(url,
				function (error, response, body){
					console.log("(Particle IN) get variable: " + body);
					
					// If no error then prepare message and send to outlet
					if(!error && response.statusCode == 200){
						var data = JSON.parse(body);
						
						var msg = {
							raw: data,
							payload: data.result,
							id: data.coreInfo.deviceID
						};

						particlemodule.send(msg);
					}
				}
			);
		});
    }
	
	RED.nodes.registerType("Particle in",ParticleIN, {
        credentials: {
            devid: {type:"password"}
        }
	});
	

	// Node-RED Output variable
	function ParticleOUT(n) {
		var particlemodule;
		
        RED.nodes.createNode(this,n);
		
		particlemodule = this;
		
		this.name = n.fve;
		this.param = n.param;
		this.baseurl = RED.nodes.getNode(n.baseurl);		

		console.log("(Particle OUT) local cloud: " + Object.keys(this.baseurl));
		console.log("(Particle OUT) local cloud: " + this.baseurl.accesstoken);

		(this.baseurl.host === "https://api.particle.io") ? this.isLocal = false : this.isLocal = true;

		if(this.baseurl.accesstoken === null || this.baseurl.accesstoken === '') {
			this.status({fill:"red",shape:"dot",text:""});
			this.error("No Particle access token in configuration node");
		} else {
			this.status({});
		}

		// Check Device ID
		if((this.credentials) && (this.credentials.hasOwnProperty("devid"))) {
			this.dev_id = this.credentials.devid;
			this.status({});
		} else {
        	// no device id set; check if user has setup a local cloud
    		this.status({fill:"red",shape:"dot",text:""});
			this.error("No Particle Device ID set");
		}

		this.on("input", function(msg){
			var val = msg.name;
			
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
			
			var url = this.baseurl.host + ":" + this.baseurl.port + "/v1/devices/" + this.dev_id + "/" + this.name;
			console.log("(Particle OUT) using URL: " + url);

			var parameter = this.param;
			
			if(parameter.length == 0){
				parameter = msg.payload;
			}
			
			// Prepare Post Data
			var postdata = {
				form: {
					access_token: this.baseurl.accesstoken,
					args: parameter
				}
			};
			
			console.log("(Particle OUT) Calling function...");
			console.log(this.dev_id);
			console.log(this.name);
				
			// Call Particle function
			Request.post(
				url, 
				postdata,
				function (error, response, body){
					// If no error, send to Node-RED
					if(!error && response.statusCode == 200){
						var data = JSON.parse(body);
						
						var msg = {
							raw: data,
							payload: data.return_value,
							id: data.id,
							name: data.name
						};

						particlemodule.send(msg);
					}
				}
			);
		});
    }
	
	RED.nodes.registerType("Particle out",ParticleOUT, {
        credentials: {
            devid: {type:"password"}
        }
	});
	

	ParticleIN.prototype.close = function() {
        if (this.interval_id != null) {
			console.log("(Particle Node) Interval closed.");
            clearInterval(this.interval_id);
        }
		
		if(this.es != null){
			console.log("(Particle Node) EventSource closed.");
			this.es.close();
		}
    }
	
	RED.httpAdmin.get('/particle/:id',function(req,res) {
		var credentials = RED.nodes.getCredentials(req.params.id);

		if (credentials) {
			res.send(JSON.stringify({devid:credentials.devid}));
		} else {
			res.send(JSON.stringify({}));
		}
	});

	RED.httpAdmin.delete('/particle/:id',function(req,res) {
		RED.nodes.deleteCredentials(req.params.id);
		res.send(200);
	});

	RED.httpAdmin.post('/particle/:id',function(req,res) {
		var body = "";
		req.on('data', function(chunk) {
			body+=chunk;
		});
		
		req.on('end', function(){
			var newCreds = querystring.parse(body);
			var credentials = RED.nodes.getCredentials(req.params.id)||{};
			if (newCreds.devid === null || newCreds.devid === "") {
				delete credentials.devid;
			} else {
				credentials.devid = newCreds.devid;
			}
			RED.nodes.addCredentials(req.params.id,credentials);
			res.send(200);
		});
	});

	RED.httpAdmin.get('/particlecloud/:id',function(req,res) {
		var credentials = RED.nodes.getCredentials(req.params.id);

		console.log("particleCloud getCredentials: " + credentials);

		if (credentials) {
			res.send(JSON.stringify({accesstoken:credentials.accesstoken}));
		} else {
			res.send(JSON.stringify({}));
		}
	});

	RED.httpAdmin.delete('/particlecloud/:id',function(req,res) {
		RED.nodes.deleteCredentials(req.params.id);
		res.send(200);
	});

	RED.httpAdmin.post('/particlecloud/:id',function(req,res) {
		var body = "";
		req.on('data', function(chunk) {
			body+=chunk;
		});
		
		req.on('end', function(){
			var newCreds = querystring.parse(body);
			var credentials = RED.nodes.getCredentials(req.params.id)||{};

			console.log("particleCloud postCredentials: " + credentials);

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