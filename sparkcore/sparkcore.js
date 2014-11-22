var EventSource = require('eventsource');
var Request = require("request");
var querystring = require('querystring');

var selectedDevice = null;
var sparkmodule = null;

module.exports = function(RED) {
	var core_id;
	var access_token;
	var param;
	var name;
	var repeat;
	var interval_id;
	var method;
	var es;

    function SparkCoreIN(n) {
        RED.nodes.createNode(this,n);
		
		sparkmodule = this;
		
        this.interval_id = null;
		this.repeat = n.repeat * 1000;
		this.name = n.fve;
		this.param = n.param;
		this.method = n.method;
		
		var credentials = RED.nodes.getCredentials(n.id);
		
		if ((credentials) && (credentials.hasOwnProperty("accesstoken"))) { 
			this.access_token = credentials.accesstoken; 
		}
        else { 
			this.error("No Spark Core access token set"); 
		}
        
		if ((credentials) && (credentials.hasOwnProperty("coreid"))) { 
			this.core_id = credentials.coreid; 
		}
        else { 
			this.error("No Spark Core device id set"); 
		}
		
		if(this.method == "function"){
			if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
				this.log("Repeat = "+this.repeat);
				
				this.interval_id = setInterval( function() {
					sparkmodule.emit("callfunction",{});
				}, this.repeat );
			} else{
				setTimeout( function(){ sparkmodule.emit("callfunction",{}); }, 100);
			}
		}
		else if(this.method == "subscribe"){
			var url = "https://api.spark.io/v1/devices/" + this.core_id + "/events/" + this.name + "?access_token=" + this.access_token;
			
			this.es = new EventSource(url);
		
			this.es.addEventListener(this.name, function(e){
				var data = JSON.parse(e.data);
			
				var msg = {
					raw: data,
					payload:data.data,
					ttl: data.ttl,
					published_at: data.published_at,
					coreid: data.coreid
				};
			
				sparkmodule.send(msg);
			}, false);

			this.es.onerror = function(){
				console.log('ES Error');
			};
		}
		else if(this.method == "variable"){
			if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
				this.log("Repeat = "+this.repeat);
				
				this.interval_id = setInterval( function() {
					sparkmodule.emit("getvariable",{});
				}, this.repeat );
			} else{
				setTimeout( function(){ sparkmodule.emit("getvariable",{}); }, 100);
			}
		}
		
		this.on("callfunction", function(){
			var url = "https://api.spark.io/v1/devices/" + this.core_id + "/" + this.name;
			
			Request.post(
				url, 
				{
					form: {
						access_token: this.access_token,
						args: this.param
					}
				},
				function (error, response, body){
					if(!error && response.statusCode == 200){
						var data = JSON.parse(body);
						var msg = {
							raw: data,
							payload: data.return_value,
							id: data.id,
							name: data.name,
							last_app: data.last_app,
							connected: data.connected
						};

						sparkmodule.send(msg);
					}
				}
			);
		});
		
		this.on("getvariable", function(){
			var url = "https://api.spark.io/v1/devices/" + this.core_id + "/" + this.name + "?access_token=" + this.access_token;
			
			Request.get(url,
				function (error, response, body){
					if(!error && response.statusCode == 200){
						var data = JSON.parse(body);
						
						var msg = {
							raw: data,
							payload: data.result,
							name: data.name,
							cmd: data.cmd
						};

						sparkmodule.send(msg);
					}
				}
			);
		});
    }
	
	function SparkCoreOUT(n) {
        RED.nodes.createNode(this,n);
		
		sparkmodule = this;
		
		this.name = n.fve;
		this.param = n.param;
		
		var credentials = RED.nodes.getCredentials(n.id);
		
		if ((credentials) && (credentials.hasOwnProperty("accesstoken"))) { 
			this.access_token = credentials.accesstoken; 
		}
        else { 
			this.error("No Spark Core access token set"); 
		}
        
		if ((credentials) && (credentials.hasOwnProperty("coreid"))) { 
			this.core_id = credentials.coreid; 
		}
        else { 
			this.error("No Spark Core device id set"); 
		}
		
		this.on("input", function(msg){
			var url = "https://api.spark.io/v1/devices/" + this.core_id + "/" + this.name;
			
			var parameter = this.param;
			
			if(parameter.length == 0){
				parameter = msg.payload;
			}
			
			var postdata = {
				form: {
					access_token: this.access_token,
					args: parameter
				}
			};
				
			Request.post(
				url, 
				postdata,
				function (error, response, body){
					if(!error && response.statusCode == 200){
						var data = JSON.parse(body);
						var msg = {
							raw: data,
							payload: data.return_value,
							id: data.id,
							name: data.name,
							last_app: data.last_app,
							connected: data.connected
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
			res.send(JSON.stringify({coreid:credentials.coreid,hasToken:(credentials.accesstoken&&credentials.coreid!=="")}));
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