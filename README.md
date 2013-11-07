# fastcgi-server: A FastCGI server implementing an API similar to node's HTTP server.

`fastcgi-server` allows you to easily switch your HTTP server app into a FastCGI server app, since the implemented API is very similar to node's HTTP server.

# Installing

	npm install fastcgi-server


# Using

Instead of requiring node's `http` module, require `fastcgi-server`:

	var fastcgi = require('fastcgi-server');

Then, create your server normally:

	fastcgi.createServer(function(req,res) {
	  if ( req.url == '/' ) {
	    res.writeHead(200, {'Content-Type': 'text/html'});
	    res.end('Hello sir!');
	  }
	  else {
	    res.writeHead(404, {'Content-Type': 'text/html'});
	    res.end('Meeh :-(');
	  }
	}).listen("/tmp/mysock.sock");

Point your webserver to /tmp/mysock.sock and... done!


# Dependences

This module is based on current (0.10.x) node.js http module structure for trying to keep a similar API. If http module changes on the future, probably fastcgi-server will not be considering this changes.
