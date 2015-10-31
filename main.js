/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:false */
/*global */

var mraa    = require('mraa');     
var request = require('request') // https://github.com/request/request
var _       = require('underscore')    // docs: http://underscorejs.org/
var bitcoin = require('bitcoinjs-lib')
var fs = require('fs');


//var addr2watch  = '1PzTDHe2GKjv2sHHKoN4Gbu2njLtekkYHh' // bitcoin address to watch 
var loop_time   = 1000  // ms   (check every second)
var balance     = null
var relayPin    = new mraa.Gpio(12)
var reset_loops = 0
var light_is_on = false

var reset_after = 30 // seconds

var check_balance = function(addr2watch) {
  request('https://blockchain.info/q/addressbalance/'+addr2watch, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var satoshi = parseInt(body)
      var btc = satoshi*Math.pow(10, -8)
      
      // this is the simplest approach, just check if the balance if different
      // you could check if the price is increased by X amount or better if you got a transaction exactly of x btc
      if (balance && balance != btc)
        activate()
      
      if (light_is_on) 
        reset_loops += 1
        
      balance = btc
    }
      
    if (reset_loops >= reset_after) {
      reset_loops = 0;
      relayPin.write(1);
      light_is_on = false;
    }
  })
}

var activate = function() {
  console.log("Address balance changed, new one is:", balance, "BTC")
  console.log("Let there be light!")
  light_is_on = true
  relayPin.write(0) // set the relay pin to low, this will trigger the relay!
}

var main = function() {
  console.log('MRAA Version: ' + mraa.getVersion());
  relayPin.dir(mraa.DIR_OUT);
  relayPin.write(1);  // I have my relay as normally closed (NC). otherwise, if it's normally open (NO) you have to invert the 0 and 1 in all the .write() calls
  
  var lcd = require('jsupm_i2clcd');
  var display = new lcd.Jhd1313m1(0, 0x3E, 0x62);

  display.setCursor(0,0);
  display.write('hi there');
    
  var public_key = generate_key();
  
  console.log("BitEdison initialized - v0.1.0 - watching address:", public_key)
  //check_balance(public_key);
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

main()