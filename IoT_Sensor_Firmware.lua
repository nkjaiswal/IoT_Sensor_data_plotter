wifi.setmode(wifi.STATION)
wifi.sta.config("miphone","nishantkr")
wifi.sta.connect()

conn = net.createConnection(net.TCP, 0) 
initval=adc.read(0)
print(initval)
-- show the retrieved web page

    
conn:on("receive", function(conn, payload)
    print(payload)
end) 
-- when connected, request page (send parameters to a script)
    conn:on("connection", function(conn, payload) 
        print("Connected")
        tmr.alarm(0,100,1, function()
            print(adc.read(0))
            if adc.read(0) > 400 then
                conn:send("GET /api/v1/add-sensor-data?sensor_id=CARS001&token=TOKEN&Pressure__c="..adc.read(0)
                    .."&lat=17.424"..math.random(100,999).."&lng=78.376"..math.random(100,999)
                    .." HTTP/1.1\r\n" 
                    .."Host: iot-car.herokuapp.com\r\n" 
                    .."Accept: */*\r\n" 
                    .."User-Agent: Mozilla/4.0 (compatible; esp8266 Lua; Windows NT 5.1)\r\n" 
                    .."\r\n")
            end
        end)
    end)
-- when disconnected, let it be known
    conn:on("disconnection", function(conn, payload) 
        print('\nDisconnected') 
        conn:connect(80,'iot-car.herokuapp.com') 
    end)
    conn:connect(80,'iot-car.herokuapp.com') 

