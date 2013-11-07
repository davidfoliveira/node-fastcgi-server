#!/usr/bin/env node

var
	fastcgi = require('../fastcgi-server');

fastcgi.createServer(function(req,res) {
	var data = "";
	req.on('data',function(chunk){
//		console.log("Data: ",chunk.toString());
		data += chunk.toString();
	});

	req.on('end',function(){
//		console.log("req: ",req);
//		console.log("data: ",data);
		if ( req.method == "POST" ) {
			if ( data && data.match(/setcookie/) )
				res.setHeader("set-cookie","coooookie="+new Date().toString());
		}

		if ( req.url == '/' ) {
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end('<html><head><meta charset=utf-8></head><body>Hello World<form method=POST><input type=hidden name=f value=xxxx><input type=submit><input type=submit name=setcookie value="Cookie"></form></body></html>\n');
		}
		else {
			res.writeHead(404);
			res.end();
		}

	});
}).listen("/tmp/nginx.sock");
