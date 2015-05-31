var express = require('express'),
    bodyParser = require('body-parser'),
    mongo = require('./mongo'),
    users = require('./routes/users'),
    shouts = require('./routes/shouts'),
    mongoose = require('mongoose'),
    LiveSocket = mongoose.model('LiveSockets'),
    User = mongoose.model('Users'),
    ObjectId = mongoose.Schema.Types.ObjectId;

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
shouts(io);
var start;

//Express
app.use(bodyParser.json());

//Enable CORS for preflight requests
app.all('*', function(req, res, next) {
  start = new Date;
  res.header("Access-Control-Allow-Origin", '*');
  //res.header('Access-Control-Allow-Credentials', 'true');

  if(req.method === 'OPTIONS'){
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'accept, content-type');
    res.header('Access-Control-Max-Age', '1728000');
    res.status(200).end();
  }
  else{
    res.setHeader('Content-Type', 'application/json');

    res.on('finish', function(){
        var duration = new Date - start;
        var post = {endpoint: req.route.path, response_time: duration, response_code: res.statusCode, verb: req.method};
        if(req.user){
            post.user = req.user.id;
        }

        console.log('Responded to '+req.method+" "+req.route.path+' with '+res.statusCode+' in '+duration+ 'ms');
    });

    next();
  }
});

//User registration
app.post('/api/users', users.register);

//Authenticate all "non-register" endpoints
app.all('/api/*', users.check);

//Authentication required endpoints
app.route('/api/shouts')
    .get(shouts.get)
    .post(shouts.add);

app.get('/api/shouts/:id', shouts.getOne);

app.post('/api/shouts/read', shouts.read);

app.post('/api/shouts/reshout', shouts.reshout);


//All other endpoints get 404
app.all('*', function(req, res) {
    res.status(404).end();
});

//Error handler
app.use(function(err, req, res, next){
    console.error(err.stack);
    res.status(500).send({message: "Something went wrong"});
});

io.on('connection', function(socket){
    console.log('a user connected');
    console.log(socket.request._query);

    var apiKey = socket.request._query['apiKey'];
    var latitude = socket.request._query['lat'];
    var longitude = socket.request._query['lng'];

    if(typeof apiKey === 'undefined' ||
        typeof latitude === 'undefined' ||
        typeof longitude === 'undefined'){
        console.log('Disconnected user!');
        return socket.disconnect();
    }

    var liveSocket = new LiveSocket({
        owner: apiKey,
        socketID: socket.id,
        loc: {
            coordinates: [longitude, latitude]
        }
    });

    liveSocket.save(function(err, doc){
        if (err){
            console.log('Disconnected user!');
            return socket.disconnect();
        }

        //Send connection event to others
        var point = { type : "Point", coordinates : liveSocket.loc.coordinates };
        LiveSocket.geoNear(point, {spherical: true, maxDistance: 250}, function(err, docs) {
            if(err){
                console.log("Could not find sockets..."+err.message);
            }
            if(typeof docs !== 'undefined') {
                var num = docs.length-1;
                docs.forEach(function (doc) {
                    if(doc.obj.socketID === socket.id){
                        socket.emit('listener',{count:num});
                    }
                    else {
                        io.to(doc.obj.socketID).emit('listener', {add: true});
                    }
                    console.log("Send to "+doc.obj.socketID);
                });
            }
        });

    });

    socket.on('disconnect', function(){
        LiveSocket.findOneAndRemove({socketID:socket.id}, function(err, doc){
            if(err){
                return console.log("Could not remove socket "+socket.id);
            }
            console.log("Removed socket "+socket.id);
            var point = { type : "Point", coordinates : doc.loc.coordinates };
            LiveSocket.geoNear(point, {spherical: true, maxDistance: 250}, function(err, docs) {
                if(err){
                    console.log("Could not find sockets..."+err.message);
                }
                if(typeof docs !== 'undefined') {
                    docs.forEach(function (doc) {
                        io.to(doc.obj.socketID).emit('listener',{remove:true});
                        console.log("Send to "+doc.obj.socketID);
                    });
                }
            });
        });
        console.log('User disconnected');
    })
});
 
server.listen(8081);
console.log('Listening on port 8081...');
