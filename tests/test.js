        var fastcgi = require('../fastcgi-server');

        fastcgi.createServer(function(req,res) {
          if ( req.url == '/' ) {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end('Hello sir!');
          }
          else {
            res.writeHead(404, {'Content-Type': 'text/html'});
            res.end('Meeh :-(');
          }
        }).listen("/tmp/nginx.sock");
