var mongoose = require('mongoose');
var User = mongoose.model('Users');

exports.register = function(req, res, next){
    var user = new User();
    user.save(function(err, doc) {
        if (err){
            next(err);
        }
        console.dir(doc);
        res.send({apiKey: doc._id});
    });
};

exports.check = function(req,res,next){
    if(!req.query.apiKey || req.query.apiKey == 'undefined'){
        res.status(401).end();  //No authentication provided
    }
    else{
        User.findById(req.query.apiKey,function(err, user){
            if(err){
                console.log("Error authenticating user "+req.query.apiKey+" - "+err.message);
                next(err);
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
}