var mongoose = require('mongoose'),
    Shout = mongoose.model('Shouts'),
    LiveSocket = mongoose.model('LiveSockets');
var io;

module.exports = function(ioPass) { io = ioPass }

module.exports.get = function(req, res, next){
    if(typeof req.query === 'undefined' ||
        typeof req.query.lng === 'undefined' ||
        typeof req.query.lat === 'undefined'){
        return res.status(400).end();
    }

    var longitude = Number(req.query.lng);
    var latitude = Number(req.query.lat);
    var since;

    since = new Date();
    since.setHours(since.getHours()-12);

    console.log('Getting shouts since '+since);
    console.log('Client Location: '+longitude+", "+latitude);

    //Search for all shouts within 250 meters in the last 12 hours. Distance multiplier is to convert radians to meters
    var point = { type: "Point", coordinates: [ longitude, latitude ] };
    Shout.geoNear(point, {spherical: true, maxDistance: 250, query: {time : { $gte : since }}}, function(err, docs) {
        var shouts = [];
        if(err){
            return next(err);
        }
        if(typeof docs !== 'undefined') {
            docs.forEach(function (doc) {
                console.log('Found Shout: '+doc.obj.loc.coordinates);
                console.log(doc.dis+"m");
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

        //User location may have changed Update socket location
        LiveSocket.findOneAndUpdate({owner:req.user._id},{loc:point},function(err, doc){
            if(err){
                console.error("Error updating user location "+err.message);
            }
        })
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
    if(typeof req.body === 'undefined' ||
        typeof req.body.lng === 'undefined' || typeof req.body.lat === 'undefined'){
        return res.status(400).end();
    }
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
    addShout(res, next, shout);
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
        console.log('Raw: '+raw);
        res.send({success:true});
    });
}

module.exports.reshout = function(req, res, next){
    if(typeof req.body === 'undefined' ||
        typeof req.body.id === 'undefined' ||
        typeof req.body.lng === 'undefined' || typeof req.body.lat === 'undefined'){
        return res.status(400).end();
    }

    var id = req.body.id;
    var longitude = req.body.lng;
    var latitude = req.body.lat;

    //find by id and update
    Shout.findById(id,function(err, doc){
        if(err){
            return next(err);
        }
        if(doc){
            var shout = new Shout({
                owner: req.user._id,
                text: doc.text,
                loc: {
                    coordinates: [longitude, latitude]
                },
                origin: doc.origin?doc.origin:doc._id               //Store the original origin if this is a reshout-reshout
            });

            //This will send response
            addShout(res, next, shout, function(reshout){
                doc.reshouts.push(reshout._id);
                doc.save();
            });
        }

    });
}


//Handles adding the specified shout to DB and sending it to all near sockets
function addShout(res, next, shout, callback){
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

        if(callback) {
            callback(doc);
        }

        var point = { type : "Point", coordinates : doc.loc.coordinates };
        LiveSocket.geoNear(point, {spherical: true, maxDistance: 250}, function(err, docs) {
            if(err){
                console.log("Could not find sockets..."+err.message);
            }
            if(typeof docs !== 'undefined') {
                docs.forEach(function (doc) {
                    shout.dis = Math.round(doc.dis);
                    io.to(doc.obj.socketID).emit('shout',shout);
                    console.log("Send to "+doc.obj.socketID);
                });
            }
        });

    });
}

