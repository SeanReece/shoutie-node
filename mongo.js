var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;

//Connect
mongoose.connect('mongodb://localhost/test');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.on('open', function (callback) {
    console.log("MongoDB opened");
});

//Schemas
var userSchema = new mongoose.Schema({
    since: { type: Date, default: Date.now }
});

var shoutSchema = new mongoose.Schema({
    owner: ObjectId,
    loc: { type: [Number], index: '2dsphere'},
    text: { type: String, required: true },
    time: { type: Date, default: Date.now },
    read: { type: Number, default: 0}
});

mongoose.model('Users', userSchema);
mongoose.model('Shouts', shoutSchema);



