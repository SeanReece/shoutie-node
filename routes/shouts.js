var mongoose = require('mongoose');
var Shout = mongoose.model('Shouts');
var io;

module.exports = function(ioPass) { io = ioPass }

module.exports.get = function(req, res, next){
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
            next(err);
        }
        docs.forEach(function(doc){
            var shout = {
                id : doc.obj._id,
                owner : doc.owner,
                time : doc.obj.time,
                text : doc.obj.text,
                read : doc.obj.read,
                dis: Math.round(doc.dis)
            }
            shouts.push(shout);
        });
        res.send(shouts);
    });
};

module.exports.add = function(req, res, next){
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
        if (err){
            next(err);
        }
        var shout = {
            id : doc._id,
            owner : doc.owner,
            time : doc.time,
            text : doc.text,
            read : doc.read,
            dis: 0
        }
        res.send(shout);

        io.emit('shout',shout);
        console.log("Send to "+io.sockets.sockets.length+ " sockets");
    });
}

module.exports.read = function(req, res, next){
    var id = req.body.id;

    Shout.findByIdAndUpdate(id, { $inc : {read:1}},{},function(err, doc){
        if(err){
           next(err);
        }
        res.send({success:true});

    });
}

