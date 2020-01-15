const express = require('express');
const router = express.Router();
const fs = require('fs')
const bcrypt = require('bcrypt');
const path = require('path')
const constants = require('../constants')
const jwt = require('jsonwebtoken')

// Login API
router.post("/login", checkNotAuthentication, (req, res) => {
    User.findOne({email: req.body.email}, async (err, user) => {
        if(err) {
            res.sendStatus(500);
        } else if(user) {
            await bcrypt.compare(password, user.getHash()).then( (resolve) => {
                if(!resolve) {
                    res.sendStatus(403);
                } else {
                    jwt.sign({"name":user.name, "email":user.email, "path":user.path}, constants.SECRET_KEY)
                }
            });
        } 
        res.sendStatus(404)
    });
});

// Register new Account.
router.post('/register', checkNotAuthentication, (req, res) => {
    var user = new User();
    user.name = req.body.name;
    user.email = req.body.email;
    user.setPath(path.dirname(__dirname) + constants.FORWARD + constants.USER_FOLDER + constants.FORWARD + req.body.email.replace(/\s/g,''));
    bcrypt.hash(req.body.password,10).then( function(hashPwd) {
        user.setHash(hashPwd);
        user.save(function(saveError) {
            if(saveError) {
                res.sendStatus(403);
            } else {
                fs.mkdirSync(user.path);
                res.sendStatus(200);
            }
        });
    });
});

/* GET "Contact Us" page. */
router.post("/contact", (req, res) => {
    var mailoptions = {
        from : 'Code4Share <no-reply@code4share.com>',
        to : 'national.creche@gmail.com',
        subject : 'You got a new mail from visitor [' + req.body.name + ']',
        text : req.body.message
    };
    transport.sendMail(mailoptions,function(err,success) {
        if(err) {
            console.log(err);
            res.sendStatus(500);
        } 
        res.sendStatus(200);        
    });
});


// Check for authentication.
function checkNotAuthentication(req, res, next) {
    return next();
}

module.exports = router;    