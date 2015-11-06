/*
  Copyright 2015 Chuan Khoo (node-red-contrib-particle 0.0.1), including:
    local cloud SSE (limited) support
    renaming to Particle
    configuration node implementation
    reconfigured clearer IN/OUT nodes
  Copyright 2014 Krishnaraj Varma (node-red-contrib-sparkcore 0.0.12)

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
  // register the existence of the Particle Cloud credentials configuration node
  RED.nodes.registerType("particle-cloud", ParticleCloudNode, {
    credentials: {
      accesstoken: {type:"password"}
    }
  });

  // ParticleSSE node - base module for subscribing to Particle Cloud SSEs
  function ParticleSSE(n) {
    var particlemodule = null;

    RED.nodes.createNode(this,n);

  	particlemodule = this;

		// note: code here runs when flow is re-deployed. n object refers to a node's instance configuration and so is unique between nodes

		// Get all properties
		this.config = n;
    this.devid = n.devid;
		this.evtname = n.evtname;
		this.baseurl = RED.nodes.getNode(n.baseurl);
		this.timeoutDelay = 5;

		// console.log("(ParticleSSE) cloud url: " + Object.keys(this.baseurl));
		// console.log("(ParticleSSE) access token: " + this.baseurl.accesstoken);

		(this.baseurl.host === "https://api.particle.io") ? this.isLocal = false : this.isLocal = true;

		if(this.baseurl.accesstoken === null || this.baseurl.accesstoken === '') {
			this.status({fill:"red",shape:"dot",text:""});
			this.error("No Particle access token in configuration node");
		} else {
			this.status({});
		}

    setTimeout( function(){ particlemodule.emit("processSSE",{}); }, this.timeoutDelay);

		// Called when there an input from upstream node(s)
		this.on("input", function(msg){
			// Retrieve all parameters from Message
			var val = msg.name;

			// Retrieve name
			if(val && val.length > 0){
				this.evtname = val;
			}

      val = msg.payload;

			// Retrieve payload
      if(val && val.length > 0){
        this.devid = val;
      }

			// console.log("(ParticleSSE) input eventName: " + this.evtname);
			// console.log("(ParticleSSE) input devID: " + this.devid);

			setTimeout( function(){ particlemodule.emit("processSSE",{}); }, this.timeoutDelay);
		});


    /*********************************************/
    // SSE (Server-Sent-Event) Subscription
		this.on("processSSE", function(){
			// if we're dealing with a local cloud, or if device ID is empty, fallback to public/event firehose & ignore device ID
			var url;
			if(this.isLocal || !this.devid) {
				url = this.baseurl.host + ":" + this.baseurl.port + "/v1/events/" + this.evtname + "?access_token=" + this.baseurl.accesstoken;
			} else {
				url = this.baseurl.host + ":" + this.baseurl.port + "/v1/devices/" + this.devid + "/events/" + this.evtname + "?access_token=" + this.baseurl.accesstoken;
			}

      if(this.es!=undefined) {
        this.es.close();
      }

			// console.log("(ParticleSSE) ES attempt to: " + url);
			this.es = new EventSource(url);

      var evt = this.evtname;

			// Add EventSource Listener
			this.es.addEventListener(evt, function(e){
				var data = JSON.parse(e.data);
				var msg = {
					raw: data,
          evtname: evt,
					payload:data.data,
					published_at: data.published_at,
					id: data.coreid						// FIXME: currently spark-server still uses coreid as property name
				};
				particlemodule.send(msg);
			}, false);

			this.es.onopen = function(){
				particlemodule.status({fill:"green",shape:"dot",text:"SSE Connected"});
				console.log('(ParticleSSE) Connected');
			};

      this.es.onclose = function(){
				particlemodule.status({fill:"grey",shape:"dot",text:"SSE Closed"});
				console.log('(ParticleSSE) Closed');
			};

			this.es.onerror = function(){
				particlemodule.status({fill:"red",shape:"ring",text:"SSE Error"});
				console.log('(Particle SSE) Error');
			};
		});
  }
  // register ParticleSSE node
	RED.nodes.registerType("ParticleSSE in", ParticleSSE, {});
  // end SSE (Server-Sent-Event) Subscription

  /*********************************************/
  // ParticleFunc node - base module for calling Particle device cloud functions
  function ParticleFunc(n) {
    var particlemodule = null;

    RED.nodes.createNode(this,n);

  	particlemodule = this;

		// note: code here runs when flow is re-deployed. n object refers to a node's instance configuration and so is unique between nodes

		// Get all properties
		this.config = n;
    this.baseurl = RED.nodes.getNode(n.baseurl);
    this.devid = n.devid;
    this.fname = n.fname;
    this.param = n.param;
    this.once = n.once;
    this.interval_id = null;
		this.repeat = n.repeat * 1000;
		this.timeoutDelay = 5;

		// console.log("(ParticleFunc) cloud url: " + Object.keys(this.baseurl));
		// console.log("(ParticleFunc) access token: " + this.baseurl.accesstoken);

		(this.baseurl.host === "https://api.particle.io") ? this.isLocal = false : this.isLocal = true;

		if(this.baseurl.accesstoken === null || this.baseurl.accesstoken === '') {
			this.status({fill:"red",shape:"dot",text:""});
			this.error("No Particle access token in configuration node");
		} else {
			this.status({});
		}

		// Check device id
    if(this.devid === null || this.devid === '') {
      this.status({fill:"yellow",shape:"dot",text:"No Device ID"});
			this.error("No Particle Device ID set");
    } else {
      this.status({});
    }

    if(this.once) {
        setTimeout( function(){ particlemodule.emit("processFunc",{}); }, this.timeoutDelay);
    }

		// Called when there an input from upstream node(s)
		this.on("input", function(msg){
			// Retrieve all parameters from Message
			var val = msg.name;

			// Retrieve new function name
			if(val && val.length > 0){
				this.fname = val;
			}

      val = msg.payload;
			// Retrieve payload as param
      if(val && val.length > 0){
        this.param = val;
      }

      // console.log("(ParticleFunc) new funcName: " + this.fname);
			// console.log("(ParticleFunc) parameter: " + this.param);

      setTimeout( function(){ particlemodule.emit("processFunc",{}); }, this.timeoutDelay);
    });

    // Call Particle Function
    this.on("processFunc", function(){
      // Check for repeat and start timer
      if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
        console.log("(ParticleFunc) Repeat = "+this.repeat);

        this.interval_id = setInterval( function() {
          particlemodule.emit("callFunc",{});
        }, this.repeat );

      }
      // There is no repeat, just start once
      else if (this.fname && this.fname.length > 0){
        setTimeout( function(){ particlemodule.emit("callFunc",{}); }, this.timeoutDelay);
      }
    });

		// Execute actual Particle Device function call
		this.on("callFunc", function(){
      var url =  this.baseurl.host + ":" + this.baseurl.port  + "/v1/devices/" + this.devid + "/" + this.fname;

			// console.log("(ParticleFunc) Calling function...");
			// console.log("URL: " + url);
			// console.log("Device ID: " + this.devid);
			// console.log("Function Name: " + this.fname);
			// console.log("Parameter: " + this.param);

			// build POST data and call Particle Device function
			Request.post(
        url,
        {
          form: {
            access_token: this.baseurl.accesstoken,
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
  }
  // register ParticleFunc node
  RED.nodes.registerType("ParticleFunc out", ParticleFunc, {});


  /*********************************************/
  // ParticleVar node - base module for retrieving Particle device variables
  function ParticleVar(n) {
    var particlemodule = null;

    RED.nodes.createNode(this,n);

  	particlemodule = this;

		// note: code here runs when flow is re-deployed. n object refers to a node's instance configuration and so is unique between nodes

		// Get all properties
		this.config = n;
    this.baseurl = RED.nodes.getNode(n.baseurl);
    this.devid = n.devid;
    this.getvar = n.getvar;
    this.interval_id = null;
		this.repeat = n.repeat * 1000;
		this.timeoutDelay = 5;

		// console.log("(ParticleVar) cloud url: " + Object.keys(this.baseurl));
		// console.log("(ParticleVar) access token: " + this.baseurl.accesstoken);

		(this.baseurl.host === "https://api.particle.io") ? this.isLocal = false : this.isLocal = true;

		if(this.baseurl.accesstoken === null || this.baseurl.accesstoken === '') {
			this.status({fill:"red",shape:"dot",text:""});
			this.error("No Particle access token in configuration node");
		} else {
			this.status({});
		}

    // Check device id
    if(this.devid === null || this.devid === '') {
      this.status({fill:"yellow",shape:"dot",text:""});
			this.error("No Particle Device ID set");
    } else {
      this.status({});
    }

		setTimeout( function(){ particlemodule.emit("processVar",{}); }, this.timeoutDelay);

		// Called when there's an input from upstream node(s)
		this.on("input", function(msg){
			// Retrieve all parameters from Message
			var val = msg.name;

			// Retrieve variable name
			if(val && val.length > 0){
				this.getvar = val;
			}

			console.log("(ParticleVar) variable changed to: " + this.getvar);

			setTimeout( function(){ particlemodule.emit("processVar",{}); }, this.timeoutDelay);
		});

		// Perform operations based on the method parameter.
		this.on("processVar", function(){
      // Check for repeat and start timer
      if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
      	this.interval_id = setInterval( function() {
      		particlemodule.emit("getVar",{});
      	}, this.repeat );
      }
      // There is no repeat, just start once
      else if (this.getvar && this.getvar.length > 0){
      	setTimeout( function(){ particlemodule.emit("getVar",{}); }, this.timeoutDelay);
      }
		});

		// Read Particle Device variable
		this.on("getVar", function(){
      var url = this.baseurl.host + ":" + this.baseurl.port + "/v1/devices/" + this.devid + "/" + this.getvar + "?access_token=" + this.baseurl.accesstoken;

			// console.log("(ParticleVar) Retrieving variable '" + this.getvar + "' from " + this.devid);
      // console.log("(ParticleVar) url: " + url);

			// Read Particle device variable and send output once response is received
			Request.get(url,
				function (error, response, body){
          // console.log("(ParticleVar) received variable: " + body);

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
  // register ParticleVar node
  RED.nodes.registerType("ParticleVar", ParticleVar, {
    credentials: {
      devid: {type:"password"}
    }
	});


  // GC upon termination of nodes
	ParticleSSE.prototype.close = function() {
		if(this.es != null){
			console.log("(Particle Node) EventSource closed.");
			this.es.close();
		}
  }

  ParticleFunc.prototype.close = function() {
    if (this.interval_id != null) {
      console.log("(ParticleFunc) Interval closed.");
      clearInterval(this.interval_id);
    }
  }

  ParticleVar.prototype.close = function() {
    if (this.interval_id != null) {
      console.log("(ParticleVar) Interval closed.");
      clearInterval(this.interval_id);
    }
  }

  // credentials management for the configuration node
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

		// console.log("particleCloud getCredentials: " + credentials);

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

			// console.log("particleCloud postCredentials: " + credentials);

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
