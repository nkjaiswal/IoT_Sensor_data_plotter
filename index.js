var express    = require('express')
var bodyParser = require('body-parser')
var cookieSession = require('cookie-session')

var app = express()
app.use(bodyParser.urlencoded({extended:false}))
app.use(bodyParser.json());
app.set('trust proxy', 1)
app.use(cookieSession({
	name: 'session',
	keys: ['niszx', 'xzsin']
}));
var port = process.env.PORT || 3000;
var server = app.listen(port, function(){
    console.log('Listening at http://127.0.0.1:' + port);    
});



app.use('/', express.static('public'))

var sensor_data = {};
var CLEAR_TIME = 3600000;
function clear_data() {
	console.log("Timer Called");
  	for(var sensor_id in sensor_data){
  		if(new Date() - sensor_data[sensor_id].last_data_received > CLEAR_TIME){
  			delete sensor_data[sensor_id];
  		}
  	}
  	setTimeout(clear_data, 60*60*1000);
}
clear_data();

let MIN_GAP_BETWEEN_TWO_SF_TICKETS_IN_SEC = 30;
var ticket = {};
function isRecentSfTicketCreated(sensor_id){
	if(!ticket[sensor_id]){
		ticket[sensor_id] = new Date();
		return false;
	}
	if(new Date() - ticket[sensor_id] > (MIN_GAP_BETWEEN_TWO_SF_TICKETS_IN_SEC * 1000)){
		ticket[sensor_id] = new Date();
		return false;
	}else{
		return true;
	}
}

let MAX_DATA = 5000;

app.get("/api/v1/add-sensor-data",function(req,res){
	validateRequest(req);
	var sensor_id = req.query.sensor_id;
	console.log("Received data for sensor " + sensor_id);
	create_sensor_entry_if_not_present(sensor_id);
	populate_sensor_data(req.query);
	if(isRecentSfTicketCreated(sensor_id)){
		res.json({message:"Not Creating SF Ticket as few moment back it is created"});
		return;
	}

	var qry = copy(req.query);

	delete qry.sensor_id;
	delete qry.token;
	delete qry.received_at;
	delete qry.lat;
	delete qry.lng;
	create_salesforce_iot_entry(sensor_id, qry, function(isDone){
		if(isDone)
			res.json({message:"Received message and Created SF Ticket"});
		else
			res.json({error:"Not able to connect to Salesforce"});
	});
});

function copy(val){
	return JSON.parse(JSON.stringify(val));
}

app.get("/api/v1/sensor-data/:sensor_id",function(req,res){
	res.json(sensor_data[req.params.sensor_id]);
});
app.get("/api/v1/sensors",function(req,res){
	var sensors = [];
	for(var sensor_id in sensor_data){
  		sensors.push(sensor_id);
  	}
  	res.json(sensors);
});

function validateRequest(req){
	var sensor_id = req.query.sensor_id;
	var token = req.query.token;
	console.log("Validating request for Sensor "+ sensor_id);
	console.log("Validation Successfull for sensor " + sensor_id);
}

var sensor_location = {};
function create_sensor_entry_if_not_present(sensor_id){
	console.log("Checking sensor details already present or not sensor " + sensor_id);
	if(sensor_data[sensor_id] == undefined){
		console.log("sensor not present " + sensor_id);
		sensor_data[sensor_id] = {
			data : []
		};
	}else{
		console.log("sensor present " + sensor_id);
	}
}

function populate_sensor_data(query){
	let sensor_id = query.sensor_id;
	console.log("populating data for sensor " + sensor_id);
	delete query.sensor_id;
	delete query.token;
	if(!isEmpty(query.lat) && !isEmpty(query.lng)){
		sensor_location[sensor_id] = {
			lat: parseFloat(query.lat),
			lng: parseFloat(query.lng)
		};
		console.log("Sensor Location" + JSON.stringify(sensor_location[sensor_id]));
	}
	query.received_at = new Date();
	delete query.lat;
	delete query.lng;
	sensor_data[sensor_id].last_data_received = new Date();
	sensor_data[sensor_id].data.push(query);
	if(sensor_data[sensor_id].data.length > MAX_DATA){
		sensor_data[sensor_id].data.shift();
	}
	query.sensor_id = sensor_id;
	console.log(JSON.stringify(sensor_data[sensor_id],null,4));
}

function isEmpty(val){
	return val == null || val == undefined || val == "";
}
//------------SALESFORCE OPERATIONS------------
var Client = require('node-rest-client').Client;
var client = new Client();

var create_iot_data_url = "https://curious-badger-r87z88-dev-ed.my.salesforce.com/services/data/v45.0/sobjects/Vehicle_Sensor__e/";
function create_salesforce_iot_entry(sensor_id, q, callback){
	var query = JSON.parse(JSON.stringify(q));
	
	console.log("populating data for sensor " + sensor_id);
	query.Registration_Number__c = sensor_id;
	console.log("SF Query", query);
	get_salesforce_access_token(function(token){
		if(token == null){
			callback(false);
		}else{
			var args = {
				data: query,
				headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": "Bearer " + token }
			}
			client.post(create_iot_data_url,args, function(data, res){
				console.log(data);
				if(res.statusCode > 199 && res.statusCode < 210)
					callback(true);
				else
					callback(false);
			});
		}
	});
}


var args = {
    data: {  },
    headers: { "Content-Type": "application/json", "Accept": "application/json" }
};
var access_token_url = "https://curious-badger-r87z88-dev-ed.my.salesforce.com/services/oauth2/token?grant_type=refresh_token&client_id=3MVG9pe2TCoA1Pf70ZNevaF8fZ7myqRXECicQehJB5VolPJfKE45Q7MKcRRqtL072w3Me5PQ_clUw3dhm6H3s&client_secret=65404477F531C3201D0F83707F10FBD18B36E95B16D3EFE4AFBB08B040B9CFFE&refresh_token=5Aep861ARUdJp8j3X2crXPunKJUJD.oYplE6Y9nWeS12IiiUSzkpjmXx5amfF7vfJckcz.urX5Mqf56MfyUQJi5";
function get_salesforce_access_token(callback){
	client.post(access_token_url, args, function(data, res){
		if(data.access_token != undefined && data.access_token != null){
			callback(data.access_token);
		}else{
			callback(null);
		}
	});
}

function clearAll(){
	sensor_data = {};
	ticket = {};
}

app.get("/api/v1/clear",function(req,res){
	clearAll();
  	res.json({});
});
//------------------------MAP OPERARTION -------------------
var service_centers = require("./service_center.json");
app.get("/api/v1/service-centers/:lat/:lng", function(req,res){
	var lat = req.params.lat;
	var lng = req.params.lng;
	if(isEmpty(lat) || isEmpty(lng)){
		res.json([]);
		return;
	}
	var sc = JSON.parse(JSON.stringify(service_centers));
	for(var i=0; i<sc.length; i++){
		sc[i].sort_rank = calculate_distance(sc[i].lat, sc[i].lng, lat, lng);
	}
	res.json(sc.sort((a,b) => a.sort_rank - b.sort_rank));
});

function calculate_distance(lat1, lng1, lat2, lng2){
	return Math.sqrt(((lat1-lat2)*(lat1-lat2))+((lng1-lng2)*(lng1-lng2)));
}

app.get("/api/v1/sensor-location/:sensor_id", function(req, res){
	res.json(sensor_location[req.params.sensor_id]);
});

//----------------------SMS Send------------------
var Client = require('node-rest-client').Client;
var client = new Client();

app.get("/api/v1/sms/:mobile", function(req, res){
	var args = {
	    data: {
		  "sender": "SFINSR",
		  "route": "4",
		  "country": "91",
		  "sms": [
		    {
		      "message": req.query.msg ,
		      "to": [
		        req.params.mobile
		      ]
		    }
		  ]
		},
	    headers: { "Content-Type": "application/json", "authkey":"163486Ab6LYlUXQwx5cc40582" }
	};
	console.log(JSON.stringify(args));
	client.post("https://api.msg91.com/api/v2/sendsms?country=91", args, function (data, response) {
	    res.json(data);
	});
});

