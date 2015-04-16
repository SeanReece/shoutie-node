var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;

//Connect
mongoose.connect('mongodb://localhost/test');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.on('open', function (callback) {
    console.log("MongoDB opened");
});
db.on('connecting', function (callback) {
    console.log("Connecting to MongoDB...");
});
db.on('connected', function (callback) {
    console.log("MongoDB connected");
});
db.on('disconnected', function (callback) {
    console.error("MongoDB disconnected");
});

//Schemas
var userSchema = new mongoose.Schema({
    since: { type: Date, default: Date.now }
});

var shoutSchema = new mongoose.Schema({
    owner: ObjectId,
    loc: {                          //Don't send to user
        type: { type: String, default: "Point" },
        coordinates: { type: [Number], required: true}
    },
    text: { type: String, required: true },
    time: { type: Date, default: Date.now },
    read: { type: Number, default: 0},
    origin: ObjectId,                //Base shout if this is reshout
    reshouts: [ { id: ObjectId } ]
});

var liveSocketSchema = new mongoose.Schema({
    owner: ObjectId,
    socketID: { type: String, required: true },
    loc: {
        type: { type: String, default: "Point" },
        coordinates: { type: [Number], required: true}
    },
    time: { type: Date, default: Date.now, expires: 3600 }
});

shoutSchema.index({ loc: '2dSphere'});
liveSocketSchema.index({ loc: '2dSphere'});

mongoose.model('Users', userSchema);
mongoose.model('Shouts', shoutSchema);
mongoose.model('LiveSockets', liveSocketSchema);



