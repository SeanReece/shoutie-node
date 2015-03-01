var mongoose = require('mongoose'),
    Shout = mongoose.model('Shouts'),
    LiveSocket = mongoose.model('LiveSockets');
var io;

module.exports = function(ioPass) { io = ioPass }

module.exports.get = function(req, res, next){
    if(typeof req.query === 'undefined' ||
        typeof req.query.lat === 'undefined' ||
        typeof req.query.lat === 'undefined'){
        return res.status(400).end();
    }

    var longitude = Number(req.query.lng);//-75.6971930;
    var latitude = Number(req.query.lat);//45.4315300;
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
    var point = { type: "Point", coordinates: [ longitude, latitude ] };
    Shout.geoNear(point, {spherical: true, maxDistance: 200, distanceMultiplier: 6371000, query: {time : { $gte : since }}}, function(err, docs) {
        var shouts = [];
        if(err){
            return next(err);
        }
        if(typeof docs !== 'undefined') {
            docs.forEach(function (doc) {
                var shout = {
                    id: doc.obj._id,
                    owner: doc.obj.owner,
                    time: doc.obj.time,
                    text: doc.obj.text,
                    read: doc.obj.read,
                    dis: Math.round(doc.dis)
                }
                shouts.push(shout);
            });
        }
        res.send(shouts);
    });
};

module.exports.getOne = function(req, res, next){
    if(typeof req.params === 'undefined' ||
        typeof req.params.id === 'undefined'){
        return res.status(400).end();
    }
    var id = req.params.id;
    console.log('Getting shouts: '+req.params.id);

    Shout.findById(id,'-__v',{ lean: true },function(err, doc){
        if(err){
            return next(err);
        }
        console.log(doc);
        var shout = {
            id : doc._id,
            owner : doc.owner,
            time : doc.time,
            text : doc.text,
            read : doc.read
        }
        res.send(shout);
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
            return next(err);
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

        var point = { type : "Point", coordinates : [9,9] };
        LiveSocket.geoNear(point, {spherical: true, maxDistance: 200, distanceMultiplier: 6371000}, function(err, docs) {
            if(err){
                console.log("Could not find sockets..."+err.message);
            }
            if(typeof docs !== 'undefined') {
                docs.forEach(function (doc) {
                    io.to(doc.obj.socketID).emit('shout',shout);
                    console.log("Send to "+doc.obj.socketID);
                });
            }
        });

    });
}

module.exports.read = function(req, res, next){
    if(typeof req.body === 'undefined' ||
        typeof req.body.id === 'undefined'){
        return res.status(400).end();
    }
    var id = req.body.id;

    Shout.update({_id: id}, { $inc : {read:1}},{},function(err, numAffected, raw){
        if(err){
           return next(err);
        }
        console.log(raw);
        res.send({success:true});
    });
}

