/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:false */
/*global */

var mraa     = require('mraa');     
var request  = require('request') // https://github.com/request/request
var _        = require('underscore')    // docs: http://underscorejs.org/
var bitcoin  = require('bitcoinjs-lib')
var fs       = require('fs');
var http     = require('http');
var qr       = require('qr-image'); 
var Simplify = require("simplify-commerce")
var lcd 	 = require('jsupm_i2clcd');

var addr2watch
var ipAddress = '172.16.10.205 '; 
var server;

var loop_time   = 1000  // ms   (check every second)
var reset_loops = 0
var payed = false
var display = new lcd.Jhd1313m1(0, 0x3E, 0x62);
var reset_after = 101 // seconds

var requestPaymentPage = fs.readFileSync('/home/root/request.html');
var waitingForPayment  = fs.readFileSync('/home/root/waiting.html');
var received           = fs.readFileSync('/home/root/received.html');
var addressPicture;

var check_balance = function(){
	request('https://blockchain.info/q/addressbalance/'+addr2watch+"?confirmations=0", function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var got_money = body;
			if(got_money  != "0")
			{
				payment_received()
				return;
			}
			reset_loops += 1
		}

		if (reset_loops >= reset_after) {
			reset_loops = 0;
			console.log("Timeout");
			return;
		}

		display.clear();
		display.setCursor(0,0);
		var n = (reset_after - reset_loops).toString();
		display.write(n);

		_.delay(check_balance, loop_time) // this is like setTimeout(check_balance, loop_Time)
	})
}

var payment_received = function() {
	console.log("Payment received!")

	display.clear();
	display.setCursor(0,0);
	display.write('Payment received!');

	var array = fs.readFileSync('api-keys.txt').toString().split("\r\n");

	/*** Simplify commerce ***/
	client = Simplify.getClient({
		publicKey: array[0],
		privateKey: array[1]
	});

	client.payment.create({
		amount : 50,
		description : "Bitcoin payment",
		card : {
			expMonth : "11",
			expYear : "19",
			cvc : "123",
			number : "5555555555554444"
		},
		currency : "GBP"
	}, function(errData, data){
		if(errData){
			console.error("Error Message: " + errData.data.error.message);
			// handle the error
			return;
		}
		console.log("Payment Status: " + data.paymentStatus);
	});

	payed = true
}

function initialise_receiver() {
	payed = false
	addr2watch = generate_key();

	var code = qr.image("bitcoin:" + addr2watch + "?amount=" + arguments[0], { type: 'png' });  
	var output = fs.createWriteStream('address.png');
	code.pipe(output);
	console.log("Watching address:", "bitcoin:" + addr2watch + "?amount=" + arguments[0]);
	check_balance();
}

function generate_key() {
	var keyPair = bitcoin.ECPair.makeRandom()
	var pub = keyPair.getAddress();
	var priv = keyPair.toWIF();

	fs.appendFile("/bitcoin/"+pub, priv, function (err) {
		if (err) return console.log(err);
		console.log('Saved sucessfully');
	});

	return pub;
}

var main = function() {
	console.log('MRAA Version: ' + mraa.getVersion());
	initialise_receiver(0.0024);
	init_server();
	start_server();
}

function init_server() {
	server = http.createServer(function (req, res) {
		var value;
		
		// This is a very quick and dirty way of detecting a request for the page
		// versus a request for light values
		
		if(req.url.indexOf('request') != -1) {
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end(requestPaymentPage);    
		}
		
		else if(req.url.indexOf("chkpyd") != -1) {
			res.writeHead(200, {'Content-Type': 'text/html'});
			if(payed) {
				res.end("true");
			}
			else {
				res.end("false");
			}
		}
		
		else if(req.url.indexOf("address.png") != -1) {
			addressPicture = fs.readFileSync('/opt/xdk-daemon/address.png');
			res.writeHead(200 , {'Content-Type' : 'image/x-png'});
			res.end(addressPicture);
		}

		else if(req.url.indexOf('payment') != -1) {
			var amount = res.getHeader("value_input");
			//var currency = res.getHeader("value_input");
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end(waitingForPayment);
		}
		
		else if(req.url.indexOf('payed') != -1){
			//var order_id = require('url').parse(req.url,true)["query"].id;
			res.writeHead(200, {'Content-Type': 'text/html'});
			received_final = String(received).replace(/<<<<<<address>>>>>>/,addr2watch);
			res.end(received_final);
		}
		
		else{
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end("shit");
		}
	});
}

function start_server() {
	server.listen(1337, ipAddress);
	console.log("Server Started");
}

main()