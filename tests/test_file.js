#!/usr/bin/env node

var
	fs = require('fs'),
	fastcgi = require('../fastcgi-server'),
	util = require('util'),
	formidable = require('formidable');

fastcgi.createServer(function(req,res) {
	var total = 0;
//	req.setEncoding("binary");
	if ( req.method == "POST" ) {
		fs.open("formfile","w",function(err,fd){
			req.on('data',function(chunk){
				fs.write(fd,chunk,0,chunk.length,null,function(){});
//				console.log(chunk.toString());
				total += chunk.length;
			});
			req.on('end',function(){
				fs.close(fd,function(){});
//				console.log("got total: "+total);
			});

			var form = new formidable.IncomingForm();
			return form.parse(req, function(err, fields, files) {
				res.writeHead(200, {'content-type': 'text/plain'});
				res.write('received upload:\n\n');
				res.end(util.inspect({fields: fields, files: files}));
			});
		});
		return;
	}

	req.on('end',function(){
//		console.log("req: ",req);
//		console.log("data: ",data);

		if ( req.url == '/' ) {
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end('<html><head><meta charset=utf-8></head><body>Hello World<form enctype="multipart/form-data" method=POST><input type=file name=f><input type=submit></form></body></html>\n');
		}
		else {
			res.writeHead(404);
			res.end();
		}

	});
}).listen("/tmp/nginx.sock");
