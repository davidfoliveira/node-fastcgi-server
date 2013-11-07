var
	fs = require('fs'),
	net = require('net'),
	http = require('http'),
	fastcgi = require('fastcgi-parser'),
	events = require('events'),
	util = require('util');


function writeSocket(socket, buffer) {
        try {
                socket.write(buffer);
        }
        catch(ex) {
                console.log(ex);
        }
}

// HTTP Request object

var httpRequest = function(socket){

	events.EventEmitter.call(this);

	this.connection = socket;
	this.url = '';
	this.headers = {};
	this._missingData = 0;

};

util.inherits(httpRequest, events.EventEmitter);



// HTTP Response object

var httpResponse = function(socket) {

	this.connection = socket;
	this.headers = { 'connection': 'close', 'content-type': 'text/plain; charset=UTF-8' };


	// Methods

	this.setHeader = function(name,value) {
		this.headers[name.toLowerCase()] = value;
	};

	this.getHeader = function(name) {
		return this.headers[name.toLowerCase()];
	};

	this.writeHead = function(status,addheaders) {

		var
			headers = "";

		// Set status

		this.status = status;

		// FCGI writer

		var writer = new fastcgi.writer();
		writer.encoding = "binary";

		// Set header for status

		this.headers['status'] = this.status;

		// Merge headers and create a string with all the headers for sending

		if ( addheaders ) {
			for ( var h in addheaders )
				this.headers[h.toLowerCase()] = addheaders[h];
		}
		for ( var h in this.headers )
			headers += h+": "+this.headers[h]+"\r\n";

		// Build the message

		var
			body = new Buffer("HTTP/1.1 "+status+" "+http.STATUS_CODES[status]+"\r\n"+headers+"\r\n"),
			msg = {
				status: 0,
				protocolStatus: 200,
				body: body,
				header: { version: fastcgi.constants.version, type: fastcgi.constants.record.FCGI_STDOUT, recordId: 1, contentLength: body.length, paddingLength: 0 }
			};

		writer.writeHeader(msg.header);
		writer.writeBody(msg.body);
		writeSocket(this.connection, writer.tobuffer());

		delete msg['body'];
		msg.header.contentLength = 0;
		writer.writeHeader(msg.header);
		writeSocket(this.connection,writer.tobuffer());

	};

	this.write = function(data) {

		// FCGI writer

		var writer = new fastcgi.writer();
		writer.encoding = "binary";

		var
			maxChunkSize = 65500;

		if ( data == null )
			return;

		var
			b = (data == null) ? null : (data instanceof Buffer) ? data : new Buffer(data),
			msg = {
				status: 0,
				protocolStatus: 200,
				header: { version: fastcgi.constants.version, type: fastcgi.constants.record.FCGI_STDOUT, recordId: 1, contentLength: 0, paddingLength: 0 }
			},
			ptr = 0;

		while ( ptr < b.length ) {
			msg.body = b.slice(ptr, ptr+(b.length-ptr>maxChunkSize?maxChunkSize:b.length-ptr));
			msg.header.contentLength = msg.body.length;
			writer.writeHeader(msg.header);
			writer.writeBody(msg.body);
			writeSocket(this.connection, writer.tobuffer());
			ptr += msg.body.length;
		}

		delete msg['body'];
		msg.header.contentLength = 0;
		writer.writeHeader(msg.header);
		writeSocket(this.connection,writer.tobuffer());

	};

	this.end = function(data) {

		// FCGI writer

		var writer = new fastcgi.writer();
		writer.encoding = "binary";

		var
			b = (data == null) ? null : (data instanceof Buffer) ? data : new Buffer(data),
			msg = {
				status: 0,
				protocolStatus: 200,
				header: { version: fastcgi.constants.version, type: fastcgi.constants.record.FCGI_STDOUT, recordId: 1, contentLength: 0, paddingLength: 0 }
			};

		// Write data if have some

		if ( data != null )
			this.write(data);

		msg.header.contentLength = 8;
		msg.header.type = fastcgi.constants.record.FCGI_END;
		writer.writeHeader(msg.header);
		writer.writeEnd(msg.status);
		writeSocket(socket, writer.tobuffer());

		if ( !this.connection.keepalive )
			this.connection.end();

	}


};


// Create a server

exports.createServer = function(handler){

	var
		req, res;

	var fcgid = net.createServer(function(socket) {
		socket.setTimeout(0);
		socket.setNoDelay(false);

		var parser = new fastcgi.parser();
		parser.encoding = "binary";
		var writer = new fastcgi.writer();
		writer.encoding = "binary";

		var FCGI_BEGIN = fastcgi.constants.record.FCGI_BEGIN;
		var FCGI_PARAMS = fastcgi.constants.record.FCGI_PARAMS;
		var FCGI_STDIN = fastcgi.constants.record.FCGI_STDIN;
		var FCGI_END = fastcgi.constants.record.FCGI_END;
		var FCGI_STDOUT = fastcgi.constants.record.FCGI_STDOUT;

		socket.ondata = function (buffer, start, end) {
			parser.execute(buffer, start, end);
		};

		socket.on("error", function(err) {
			console.log(err);
			if ( req )
				req.emit('close',err);
		});

		socket.on("close", function() {
			// Connection closed
			if ( req )
				req.emit('close');
		});


		// New connection

		socket.keepalive = false;

		// Create new request

		req = new httpRequest(socket);

		// Listen to parser events

		parser.onError = function(exception) {
			console.log(exception);
		};
		parser.onRecord = function(record) {
			switch(record.header.type) {
				case FCGI_BEGIN:
					socket.keepalive = (record.body.flags == 1);
					break;
				case FCGI_PARAMS:
					if ( record.header.contentLength > 0 ) {
						if ( record.body && typeof(record.body.params) == "object" ) {
//							console.log(record.body.params);

							// Request line

							req.url = record.body.params['SCRIPT_NAME']+(record.body.params['QUERY_STRING'] != '' ? "?"+record.body.params['QUERY_STRING'] : "");
							req.method = record.body.params['REQUEST_METHOD'];
							req.httpVersion = record.body.params['SERVER_PROTOCOL'];
							if ( req.httpVersion.match(/HTTP\/(\d+)\.(\d+)/) ) {
								req.httpVersionMajor = parseInt(RegExp.$1);
								req.httpVersionMinor = parseInt(RegExp.$1);
							}

							// HTTP headers

							for ( var v in record.body.params ) {
								if ( v.match(/^http_(\w+)$/i) ) {
									var header = RegExp.$1.toLowerCase().replace(/_/g,'-');
									req.headers[header] = record.body.params[v];
								}
							}

							// Some other HTTP headers

							if ( record.body.params['CONTENT_TYPE'] != null )
								req.headers['content-type'] = record.body.params['CONTENT_TYPE'];
							if ( record.body.params['CONTENT_LENGTH'] != null && req.headers['content-length'] == null )
								req.headers['content-length'] = record.body.params['CONTENT_LENGTH'];
						}
					}
					else {
						res = new httpResponse(socket);
						handler(req,res);
					}
					break;
				case FCGI_STDIN:
					if(record.header.contentLength == 0)
						req.emit('end');
					else
						req._missingData = record.header.contentLength;
					break;
			}
		};
		parser.onBody = function(chunk,offset,length) {
			req.emit('data',chunk.slice(offset,length));
		};
	});

	return { socket: fcgid, listen: listen };

};

function listen(socketPath,handler) {

	var
		self = this;

	if ( !handler )
		handler = function(){};

	if ( socketPath.match(/^\//) ) {
		return fs.stat(socketPath,function(err,stats){
			if ( err ) {
				if ( err.code == 'ENOENT' )
					return self.socket.listen(socketPath);
				return handler(null,err);
			}
			if ( stats.isSocket() ) {
				fs.unlink(socketPath,function(){
					return self.socket.listen(socketPath,handler);
				});
			}
			else
				return handler(null,new Error("File "+socketPath+" already exists"));
		});	
	}
	return self.socket.listen(socketPath,handler);

}
