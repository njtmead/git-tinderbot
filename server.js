var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);


var port = 3000;
var ip = '127.0.0.1';

//console.log(process.env);



http.listen(port, function(){
  console.log('listening on ' + ip + ":" + port);
});

var fs = require('fs');


var tinder = require('tinderjs');
var client = new tinder.TinderClient();



var Browser = require("zombie");

var browser = new Browser();
var browser2 = new Browser();

var fbtoken = "";
var fbid = "";



app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){

	console.log('a user connected');
  
	io.to(socket.id).emit('get cookie', "no data needed");
	
	socket.on('set cookie', function(data){
	  
		fbid = data.fbid;
		fbtoken = data.fbtoken;

		//only continue if fbid set
		if (fbid) {
		
			client.authorize(fbtoken, fbid, function(error, res, body){
			
				if (error) {

					console.log("Login failed: " + error);
					io.to(socket.id).emit('logged out');
				
				} else {
				
					console.log("Logged In Successfully");
					io.to(socket.id).emit('logged in');
					
					//if authorised check for existing history
					fs.stat('history/'+fbid+'.txt', function(err, stat) {
					
						if(err == null) {
							console.log('File exists');
							
							fs.readFile('history/'+fbid+'.txt', (err, data) => {
								if (err) {
									console.log("file read error");
								}
								
								console.log("Reading data from file");				  
								data = JSON.parse(data);			  
								io.to(socket.id).emit('matches', data);
								return;
							  
							});			
							
						} else if(err.code == 'ENOENT') {
							//fs.writeFile('log.txt', 'Some log\n');
							console.log("no file: enoent");
						} else {
							console.log('no file: Some other error: ', err.code);
						}
					});

				}					
								
			});			
			
		}
		
	});
	
	socket.on('update', function(){

		io.to(socket.id).emit('matches', "");
		
		io.to(socket.id).emit('chat message', "loading updates...");

		client.getHistory(function(error, data){
		
			if (error) {

				console.log("get history failed: " + error);
				io.to(socket.id).emit('logged out');
			
			} else {
			
				io.to(socket.id).emit('matches', data);

				fs.writeFile('history/'+fbid+'.txt', JSON.stringify(data,null,4), function (err) {
					if (err) return console.log(err);

					console.log("matches data file created");
				});
				
			}
			
		});					
		
	});  
  
	socket.on('login', function(data){
	
		console.log('loggin in requested');
		console.log('fbemail: ' + data.fbemail);
		console.log('fbpass: ' + data.fbpass);
		console.log('attempting fb login now...');
		
		io.to(socket.id).emit('chat message', 'Logging in to fb now...');
		
		browser.on('redirect', function(request, response, redirectRequest){
		
			console.log(redirectRequest);
		
			io.to(socket.id).emit('chat message', "wrong username or password");
			
			i = redirectRequest.indexOf("access_token=");
			
			if (i > -1){
				
				var fbtoken = redirectRequest.substr(i + 13, redirectRequest.length - i - 13);		
				var j = fbtoken.indexOf("&");		
				fbtoken = fbtoken.substr(0, j);		
				console.log(fbtoken);
				
				io.to(socket.id).emit('chat message', fbtoken);		
				
				var url = "https://graph.facebook.com/me?fields=id&access_token=" + fbtoken;
						
				browser2.visit(url, function() {
				
					jsondata = browser2.text("body");	
					jsondata = JSON.parse(jsondata);
					fbid = jsondata.id;
					console.log(fbid);
					
					io.to(socket.id).emit('chat message', fbid);
					
					obj = { fbid: fbid, fbtoken: fbtoken };
					
					io.to(socket.id).emit('set cookie', obj);				
					
					client.authorize(fbtoken, fbid, function(error, res, body){
					
						if (error) {

							console.log("Login failed: " + error);
							io.to(socket.id).emit('logged out');
						
						} else {
						
							console.log("Logged In Successfully");
							io.to(socket.id).emit('logged in');

						}					
										
					});				
					
				});
			
			}	
			
		});

		browser.visit("https://www.facebook.com/dialog/oauth?client_id=464891386855067&redirect_uri=https://www.facebook.com/connect/login_success.html&scope=basic_info,email,public_profile,user_about_me,user_activities,user_birthday,user_education_history,user_friends,user_interests,user_likes,user_location,user_photos,user_relationship_details&response_type=token");

		browser.wait(5000, function() {
		
			console.log("checking if email input is on page...");
			//console.log(browser.query('#email'));
			
			if ( browser.query('#email') && browser.query('#pass') && browser.query('input[name="login"]') ){
				
				browser.fill('#email', "nickmead@live.com.au");
				browser.fill('#pass', "rashneil69");	
				browser.pressButton('input[name="login"]');
				
			}
			
		});		
	
	});
	
	socket.on('msg her', function(data){
	
		herid = data.herid;
		themsg = data.themsg;
		
		console.log("the msg: " + themsg);		
		
		client.sendMessage(herid, themsg);			
	
	});
  
	socket.on('disconnect', function(){
		console.log('user disconnected');
	});  
  
});