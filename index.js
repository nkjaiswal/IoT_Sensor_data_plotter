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


let MAX_DATA = 300;

app.get("/api/v1/add-sensor-data",function(req,res){
	validateRequest(req);
	var sensor_id = req.query.sensor_id;
	console.log("Received data for sensor " + sensor_id);
	create_sensor_entry_if_not_present(sensor_id);
	populate_sensor_data(req.query);
	res.end("done");
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
	console.log(JSON.stringify(sensor_data[sensor_id],null,4));
}
