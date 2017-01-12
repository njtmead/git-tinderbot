var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var multer = require('multer');
var upload = multer({ dest: './uploads/'});




var port = 3000;

app.use(express.static(__dirname));

http.listen(port, function(){
  console.log('listening on port %s', port);
});

var fs = require('fs');
var tinder = require('tinderjs');
var Browser = require("zombie");

var filesallowed = true;

//var client = new tinder.TinderClient();


app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

app.post('/api/photos', upload.single('userPhoto'), function(req, res) {

	//console.log(JSON.stringify(req.file));
	
	res.send({
		path: req.file.path
	});

});

io.on('connection', function(socket){

	socket.tinderloggedin = false;
	
	socket.tinderclient = new tinder.TinderClient();

	console.log('user connected %s', socket.id);
	
	io.to(socket.id).emit('get cookie');
	
	socket.on('set cookie', function(data){
	
		if (data.fbid && data.fbtoken) {
		
			fbid = data.fbid;
			fbtoken = data.fbtoken;
	
			authorise(fbtoken, fbid, socket);
			
		} else {
		
			io.to(socket.id).emit('logged out');
		
		}
	
	});	
  
	socket.on('login', function(data){
	
		console.log("fb login on socket: %s", socket.id);
	
		fblogin(socket, data);	
	
	});
	
	socket.on('update history', function(data){
	
		console.log("updating history emitted");
		console.log(data);
	
		loadhistory(socket, new Date(data));
	
	});
	
	socket.on('update user', function(data){
	
		for (i=0; i<data.length; i++){
	
			//console.log("updating user: %s", data[i]);
			//console.log(data);
			
			updateuser(data[i], socket);	
			
		}
	
	});
	
	socket.on('send msg', function(data){
	
		id = data.id;
		msg = data.msg;
		
		console.log("the msg: " + msg);	
		
		sendmsg(id, msg, socket);
	
	});
		
	socket.on('get recs', function(){
		console.log('user wants recs');
		
		socket.tinderclient.getRecommendations(10, function(error, data){
		
			if (data) {
			
				console.log("recs sent");
				
				console.log(data);
			
				io.to(socket.id).emit('recs', data);
			
			}
		
		});		
		
	}); 
	
	socket.on('swipe action', function(data){
	
		swipeaction = data.swipeaction;		
		swipemethod = swipeaction.substring(0,4);
		swipeid = swipeaction.substring(4);
		
		console.log("%s for id: %s", swipemethod, swipeid);
		
		if (swipemethod == "like"){
			socket.tinderclient.like(swipeid, function(error, data){
				if (error){
					console.log(error);
				} else if (data) {
					console.log(data);
				}
			});
		} else if (swipemethod == "pass"){
			socket.tinderclient.pass(swipeid, function(error, data){
				if (error){
					console.log(error);
				} else if (data) {
					console.log(data);
				}
			});
		}		
		
	});
	
	socket.on('delete', function(){
		
		socket.tinderfile = false;
		loadhistory(socket, new Date("2012"));
		
	});  
	
	socket.on('set position', function(data){
	
		//console.log("set position...");
		//console.log(data);
		
		socket.tinderclient.updatePosition(data.lng, data.lat, function(error, data){
		
			if (error) {
					
				console.log(error);
				io.to(socket.id).emit('chat message', 'Position change error! Wait 15 mins or move closer.');
			
			} else if (data) {
										
				if (!data.error){
				
					console.log("POSITION UPDATED SUCCESSFULLY");
					io.to(socket.id).emit('chat message', 'Position change success!');
									
				} else {
				
					console.log(data);				
					io.to(socket.id).emit('chat message', 'Position change error! Wait 15 mins or move closer.');
				}
				
			} else {
			
				console.log("set position error");
				io.to(socket.id).emit('chat message', 'Position change error! Wait 15 mins or move closer.');
			
			}
		
		});
		
	});  
	

		  
	socket.on('disconnect', function(){
		socket.tinderloggedin = false;
		io.to(socket.id).emit('logged out');
		console.log('user disconnected %s', socket.id);
	});  
  
});

function sendmsg(id, msg, socket){

	socket.tinderclient.sendMessage(id, msg, function(err, data){
	
		if(data){
			console.log("data received after send");
			console.log(data);	
			io.to(socket.id).emit('msg sent');
			
		} else {
			console.log("msg probably not sent to %s", id);
			sendmsg(id, msg, socket);
		}
	
	});

}

function fblogin(socket, data){

var browser = new Browser();
var browser2 = new Browser();

	socket.tinderloggedin = false;	
	io.to(socket.id).emit('logged out');

	//console.log('log in requested');
	//console.log('fbemail: ' + data.fbemail);
	//console.log('fbpass: ' + data.fbpass);
	console.log('attempting fb login now...');
	
	io.to(socket.id).emit('chat message', 'Logging in to fb now...');
		
	browser.on('redirect', function(request, response, redirectRequest){
	
		console.log("redirected...");			
		//console.log("redirect request was: %s",redirectRequest);	
				
		i = redirectRequest.indexOf("access_token=");
		
		if (i > -1){
			
			fbtoken = redirectRequest.substr(i + 13, redirectRequest.length - i - 13);		
			tokenindex = fbtoken.indexOf("&");		
			fbtoken = fbtoken.substr(0, tokenindex);		
			console.log('fbtoken found in url: %s',fbtoken);
			
			//io.to(socket.id).emit('chat message', fbtoken);		
			
			url = "https://graph.facebook.com/me?fields=id&access_token=" + fbtoken;
					
			browser2.visit(url, function() {
			
				if (browser2.success){
			
					jsondata = browser2.text("body");	
					jsondata = JSON.parse(jsondata);
					fbid = jsondata.id;
					console.log('fbid found from url: %s',fbid);
									
					//for cookie
					obj = { fbid: fbid, fbtoken: fbtoken };				
					io.to(socket.id).emit('set cookie', obj);				

					//authorise
					authorise(fbtoken, fbid, socket);	

				}
				
			});
		
		} else {
		
			//browser.pressButton(okaybtn);
			
		}
		
		
	});

	
	browser.visit("https://www.facebook.com/dialog/oauth?client_id=464891386855067&redirect_uri=https://www.facebook.com/connect/login_success.html&scope=basic_info,email,public_profile,user_about_me,user_activities,user_birthday,user_education_history,user_friends,user_interests,user_likes,user_location,user_photos,user_relationship_details&response_type=token", function(){
	
		console.log("browser loaded...");
		console.log(data);
		console.log("browser success: %s", browser.success);
		
		if (browser.success){
		
			emailinput = browser.query('#email');
			passinput = browser.query('#pass');
			loginbtn1 = browser.query('input[name="login"]');
			loginbtn2 = browser.query('#loginbutton');
			
			if ( emailinput && passinput ){
			
				console.log("and all the inputs are there");
				
				browser.fill(emailinput, data.fbemail);
				browser.fill(passinput, data.fbpass);
								
				if (loginbtn1) {
				
					console.log("login btn 1 found");				
					browser.pressButton(loginbtn1, function(){
					
						console.log("button 1 pressed and loaded...");
						//console.log(browser.html());
						//console.log(browser.text('body'));
						
						//okaybtn = browser.query('button[name="__CONFIRM__"]');
												
						//if (okaybtn){
							//console.log("okay btn found");
							//browser.pressButton(okaybtn);
						//}
					
					});
					
				} else if (loginbtn2) {
				
					console.log("login btn 2 found");				
					browser.pressButton(loginbtn2, function(){
					
						console.log("button 2 pressed and loaded...");
						//console.log(browser.html());
						//console.log(browser.html('[type="submit"]'));
						//console.log(browser.xpath('//*[@name="__CONFIRM__"]'));
						//console.log(browser.text('body'));		
						
						//okaybtn = browser.query('button[name="__CONFIRM__"]');
												
						//if (okaybtn){
							//console.log("okay btn found");
							//browser.pressButton(okaybtn);
						//}
												
					});
					
				} 
				
				//if not logged in after X seconds, display error
				setTimeout(function(){
				
					if (!socket.tinderloggedin) {
					
						io.to(socket.id).emit('chat message', "Login Failed.<br><br>Check your login details and try again.<br><br>You must allow tinder facebook permissions for the app to work. If you have not yet done so, click below to do this now. Return here to login after permissions are set.<br><br><a class='btn btn-info' target='_Blank' href='https://www.facebook.com/dialog/oauth?client_id=464891386855067&redirect_uri=https://www.facebook.com/connect/login_success.html&scope=basic_info,email,public_profile,user_about_me,user_activities,user_birthday,user_education_history,user_friends,user_interests,user_likes,user_location,user_photos,user_relationship_details&response_type=token'>Allow eTinder Permission</a><br><br>");
					
					}
				
				}, 5000);
				
			}	
			
		}
	
	});
	
	//button to click okay
	//<button value="1" class="_42ft _4jy0 layerConfirm _51_n autofocus uiOverlayButton _4jy5 _4jy1 selected _51sy" name="__CONFIRM__" type="submit" tabindex="0">Okay</button>
	
}

function authorise(fbtoken, fbid, socket){

	socket.tinderclient.authorize(fbtoken, fbid, function(error, res, body){
	
		if (error) {

			console.log("Login failed: " + error);
			io.to(socket.id).emit('logged out');
		
		} else if (body) {		
		
			//console.log(body);			
		
			socket.tinderloggedin = true;	
			socket.tinderfbid = fbid;
			socket.tinderfirst = true;
			
			//console.log("Defaults: %s",JSON.stringify(socket.tinderclient.getDefaults()));			
								
			console.log("Logged In Successfully");
			console.log("User ID: %s",socket.tinderclient.userId);
			//console.log("Defaults: %s",JSON.stringify(socket.client.defaults));			
			
			loginID = socket.tinderclient.userId;			
			io.to(socket.id).emit('logged in', {loginID: loginID});
			io.to(socket.id).emit('chat message', "loading matches, this could take a few minutes");
			
			//CHECK FOR FILE
			checkforfile(socket,fbid);

		} else {

			console.log("Login failed: " + error);
			io.to(socket.id).emit('logged out');
			
		}
						
	});

}

function checkforfile(socket, fbid){

	console.log(socket.tinderfbid);
	
	//turn files off
	if (filesallowed) {

		fs.stat('history/'+fbid+'.txt', function(err, stat) {
		
			if(err == null) {
				console.log('File exists');
				
				fs.readFile('history/'+fbid+'.txt', function(err, data) {
				
					if (err) {
					
						console.log("file read error");
						loadhistory(socket, new Date("2012"));
						
					} else if(data){		
					
						console.log("Reading data from file");
						
						try {
							data = JSON.parse(data);
						} catch (e) {
							//go to get history instead if file error
							console.error(e);
							console.log("got file error so load history");
							loadhistory(socket, new Date("2012"));
							return;
						}		

						socket.tinderfile = true;
						io.to(socket.id).emit('matches', data);
						
						//GET HISTORY
						socket.tinderclient.getUpdates(new Date("2012"), function(error, data){	
						
							//console.log("history loaded");
						
							if (error) {

								console.log("history update failed: %s", error);
								io.to(socket.id).emit('logged out');
							
							} else {
									
								//write to file
								fs.writeFile('history/'+socket.tinderfbid+'.txt', JSON.stringify(data,null,4), function (err) {

									if (err) {
										console.log("write file error: %s",err);
									} else {	
										console.log("*** UPDATED MATCHES FILE ***");
									}
									
								});								
								
							}				
							
						});						
						
					}	
					
				});			
				
			} else {
			
				loadhistory(socket, new Date("2012"));
						
			}
			
		});
		
	} else {
	
		console.log("load history from 1");
		loadhistory(socket, new Date("2012"));
		
	}

}

function loadhistory(socket, mylastactivity){

	console.log('loading history for %s', mylastactivity);	
	
	//GET HISTORY
	socket.tinderclient.getUpdates(mylastactivity, function(error, data){	
	
		if (error) {

			console.log("history update failed: %s", error);
			io.to(socket.id).emit('logged out');
		
		} else {
		
			console.log("history update completed!");
			
			//console.log(data);
			
			io.to(socket.id).emit('matches', data);				
				
			//turn files off
			if (!socket.tinderfile && filesallowed){
			
				socket.tinderfile = true;
			
				//write to file
				fs.writeFile('history/'+socket.tinderfbid+'.txt', JSON.stringify(data,null,4), function (err) {

					if (err) {
						console.log("write file error: %s",err);
					} else {	
						console.log("*** UPDATED MATCHES FILE ***");
					}
					
				});
				
			}
						
		}				
		
	});			

}

function updateuser(personid, socket){

	socket.tinderclient.getUser(personid, function(error, data){
	
		if(error){
			//try again if error

			console.log("error with user update");
			console.log(error);
			
			updateuser(personid, socket);			
			
		} else if(data){
		
			console.log("user updated");
			//console.log(data);
		
			userdata = new Object();		
			
			userdata.id = data.results._id;
			userdata.distance = data.results.distance_mi;
			userdata.pingtime = data.results.ping_time;			
			
			//console.log(userdata);
			
			io.to(socket.id).emit('user data', userdata);
		
		} else {
			updateuser(personid, socket);
		}
																					
	});

}