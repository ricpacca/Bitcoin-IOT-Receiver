/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:false */
/*global */

var mraa    = require('mraa');     
var request = require('request') // https://github.com/request/request
var _       = require('underscore')    // docs: http://underscorejs.org/
var bitcoin = require('bitcoinjs-lib')
var fs =      require('fs');
var qr = require('qr-image'); 

var addr2watch
var ipAddress = '172.16.10.205 '; 
var server;
var http = require('http');
var dict = {};
//var addr2watch  = '1PzTDHe2GKjv2sHHKoN4Gbu2njLtekkYHh' // bitcoin address to watch 
var loop_time   = 1000  // ms   (check every second)
var balance     = null
var relayPin    = new mraa.Gpio(12)
var reset_loops = 0
var light_is_on = false

var lcd = require('jsupm_i2clcd');
var display = new lcd.Jhd1313m1(0, 0x3E, 0x62);

var reset_after = 30 // seconds
var i = 0

var requestPaymentPage = fs.readFileSync('/home/root/request.html');
var waitingForPayment = fs.readFileSync('/home/root/waiting.html');

var check_balance = function(){
  // this version uses blockchain.info direct api - but I could've used blockr.io, blockcypher, etc... prefer the ones that don't require an access keys
  request('https://blockchain.info/q/addressbalance/'+addr2watch, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var satoshi = parseInt(body)
      var btc = satoshi*Math.pow(10, -8)
      
      // this is the simplest approach, just check if the balance if different
      // you could check if the price is increased by X amount or better if you got a transaction exactly of x btc
      if (balance && balance != btc) {
        payment_received()
        return
      }
      
      if (light_is_on) 
        reset_loops += 1
        
      balance = btc
    }
      
    if (reset_loops >= reset_after) {
      reset_loops = 0;
      relayPin.write(1);
      light_is_on = false;
    }
    
    if (i==17) {
        i=0;
        display.clear();
    }
      
    display.setCursor(0,i++);
    display.write('-');
      
    _.delay(check_balance, loop_time) // this is like setTimeout(check_balance, loop_Time)
  })
}

var payment_received = function() {
  console.log("Address balance changed, new one is:", balance, "BTC")
}

function initialise_receiver() {
    addr2watch = generate_key();

    var code = qr.image(addr2watch, { type: 'png' });  
    var output = fs.createWriteStream('address.png');
    code.pipe(output);
    
    console.log("Watching address:", addr2watch);
    check_balance();
}

function generate_key() {
    var keyPair = bitcoin.ECPair.makeRandom()
    var pub = keyPair.getAddress();
    var priv = keyPair.toWIF();
    
    
    /**
    fs.writeFile(publicKey, privateKey, function (err) {
      if (err) return console.log(err);
      console.log('unable to file');
    });
    **/
    
    return pub;
}

var main = function() {
  console.log('MRAA Version: ' + mraa.getVersion());
  relayPin.dir(mraa.DIR_OUT);
  relayPin.write(1);  // I have my relay as normally closed (NC). otherwise, if it's normally open (NO) you have to invert the 0 and 1 in all the .write() calls

    //start web server
    init_server();
    start_server();
  initialise_receiver();
}

function init_server()
{
    server = http.createServer(function (req, res) {
    var value;
    // This is a very quick and dirty way of detecting a request for the page
    // versus a request for light values
    if(req.url.indexOf('request') != -1){
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(requestPaymentPage);    
    }
    else if(req.url.indexOf("chkpyd") != -1)
    {
            res.writeHead(200, {'Content-Type': 'text/html'});
            while(true)
            {
                res.end("true");
            }
        }
    else if(req.url.indexOf('payment') != -1){
        var amount = res.getHeader("value_input");
        //var currency = res.getHeader("value_input");
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(waitingForPayment);    
    }
        else if(req.url.indexOf('payed') != -1){
            var order_id = require('url').parse(req.url,true)["query"].id;
            
        }
            else{
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end("shit");
    }
});
}

function start_server()
{
    server.listen(1337, ipAddress);
    console.log("Server Started");
}


//lightSensorPage = String(lightSensorPage).replace(/<<ipAddress>>/, ipAddress);






main()