var express = require('express'),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose');

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var ObjectId = mongoose.Schema.Types.ObjectId;

mongoose.connect('mongodb://localhost/test');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.on('open', function (callback) {
    console.log("MongoDB opened");
});

var userSchema = new mongoose.Schema({
    since: { type: Date, default: Date.now }
});
var User = mongoose.model('Users', userSchema);

var shoutSchema = new mongoose.Schema({
    owner: ObjectId,
    loc: {
        type: { type: String, default: "Point" },
        coordinates: { type: [Number], required: true}
    },
    text: { type: String, required: true },
    time: { type: Date, default: Date.now }
});

//Uncomment in prod
//shoutSchema.set('autoIndex', false);
var Shout = mongoose.model('Shouts', shoutSchema);

//Express
app.use(bodyParser.json());
var start;

//Enable CORS for preflight requests
app.all('*', function(req, res, next) {
  start = new Date;
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header('Access-Control-Allow-Credentials', 'true');

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
app.post('/api/users', function(req, res, next){
    var user = new User();
    user.save(function(err, doc) {
        if (err) return console.error(err);
        console.dir(doc);
        res.send({apiKey: doc._id});
    });
});

io.on('connection', function(socket){
    console.log('a user connected');

    socket.on('disconnect', function(){
        console.log('User disconnected');
    })
});

//Authenticate all "non-register" endpoints
app.all('/api/*', function(req,res,next){
    if(!req.query.apiKey){
        res.status(401).end();  //No authentication provided
    }
    else{
        User.findById(req.query.apiKey,function(err, user){
            if(err){
                console.log("Error authenticating user "+req.query.apiKey+" - "+err.message);
                res.status(500).end();
            }
            else if(user){
                req.user = user;
                next();
            }
            else{
                res.status(401).end();  //Incorrect authentication provided
            }
        });
    }
});

app.route('/api/shouts')
    .get(function(req, res, next){
        var longitude = Number(req.query.lng);//-75.6971930;
        var latitude = Number(req.query.lat);//45.4315300;//req.body.lat;
        var since;

        if(typeof req.query.since === 'undefined'){
            since = new Date();
            since.setHours(since.getHours()-12);
        }
        else{
            since = new Date(req.query.since);
        }
        console.log('Getting shouts since '+since);

        //Search for all shouts within 200 meters in the last 12 hours or since specified time. Distance multiplier is to convert radians to meters
        Shout.geoNear({ type: "Point", coordinates: [ longitude, latitude ] }, {spherical: true, maxDistance: 200, distanceMultiplier: 6371000, query: {time : { $gte : since }}}, function(err, docs) {
            var shouts = [];
            if(err){
                console.error("Error retrieving shouts "+err.message);
                res.status(500).end();
            }
            docs.forEach(function(doc){
                var shout = {
                    owner : doc.owner,
                    time : doc.obj.time,
                    text : doc.obj.text,
                    id : doc.obj._id,
                    dis: Math.round(doc.dis)
                }
                shouts.push(shout);
            });
            res.send(shouts);
        });
    })
    .post(function(req, res, next){
        var text = req.body.text;
        var longitude = req.body.lng;
        var latitude = req.body.lat;

        var shout = new Shout({
            owner: req.user._id,
            text: text,
            loc: {
                coordinates: [longitude, latitude]
            }
        });
        shout.save(function(err, doc) {
            if (err) return console.error(err);
            var shout = {
                owner : doc.owner,
                time : doc.time,
                text : doc.text,
                id : doc._id,
                dis: 0
            }
            res.send(shout);

            io.emit('shout',shout);
            console.log("Send to "+io.sockets.connected.length+ " sockets");
        });
    });


app.all('/api/*', function(req, res) {
    res.status(404).end();
});

//Error handler
app.use(function(err, req, res, next){
    console.error(err.stack);
    res.send(500, 'Something broke!');
});
 
server.listen(8080);
console.log('Listening on port 8080...');
