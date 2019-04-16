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
function isRecentSfTicketCreated(sensor_id){
	if(new Date() - sensor_data[sensor_id].last_data_received > (MIN_GAP_BETWEEN_TWO_SF_TICKETS_IN_SEC * 1000)){
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
	create_salesforce_iot_entry(req.query, function(isDone){
		if(isDone)
			res.json({message:"Received message and Created SF Ticket"});
		else
			res.json({error:"Not able to connect to Salesforce"});
	});
});

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
	query.received_at = new Date();
	sensor_data[sensor_id].last_data_received = new Date();
	sensor_data[sensor_id].data.push(query);
	if(sensor_data[sensor_id].data.length > MAX_DATA){
		sensor_data[sensor_id].data.shift();
	}
	query.sensor_id = sensor_id;
	console.log(JSON.stringify(sensor_data[sensor_id],null,4));
}

//------------SALESFORCE OPERATIONS------------
var Client = require('node-rest-client').Client;
var client = new Client();

var create_iot_data_url = "https://curious-badger-r87z88-dev-ed.my.salesforce.com/services/data/v45.0/sobjects/Vehicle_Sensor__e/";
function create_salesforce_iot_entry(q, callback){
	var query = JSON.parse(JSON.stringify(q));
	let sensor_id = query.sensor_id;
	console.log("populating data for sensor " + sensor_id);
	delete query.sensor_id;
	delete query.token;
	delete query.received_at;
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



