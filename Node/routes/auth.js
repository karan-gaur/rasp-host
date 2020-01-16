const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const constants = require('../constants');
const nodemailer = require('nodemailer');
const transport = nodemailer.createTransport(config.mailer);

// Login API
router.post("/login", (req, res) => {
    User.findOne({email: req.body.email}, async (err, user) => {
        if(err) {
            console.log(err)
            res.sendStatus(500);
        } else if(user) {
            await bcrypt.compare(req.body.password, user.getHash()).then( (resolve) => {
                if(!resolve) {
                    res.sendStatus(403);
                } else {
                    const token = jwt.sign({
                        "name":user.name,
                        "email":user.email,
                        "path":user.path
                    }, constants.SECRET_KEY, {
                        expiresIn: '365d' // expires in 365 days
                   });
                   res.json({"token": token});
                }
            });
        } else {
            res.sendStatus(404);
        }
    });
});

// Register new Account.
router.post('/register', (req, res) => {
    var user = new User();
    user.name = req.body.name;
    user.email = req.body.email;
    user.setPath(path.dirname(__dirname) + constants.FORWARD + constants.USER_FOLDER + constants.FORWARD + req.body.email.replace(/\s/g,''));
    bcrypt.hash(req.body.password,10).then( function(hashPwd) {
        user.setHash(hashPwd);
        user.save(function(saveError) {
            if(saveError) {
                console.log(saveError)
                res.sendStatus(403);
            } else {
                fs.access(user.path, (err) => {
                    if(err)
                        fs.mkdirSync(user.path);
                });
                res.sendStatus(200);
            }
        });
    });
});

// GET Contact Us page. 
router.post("/contact", (req, res) => {
    const mailoptions = {
        from : req.body.email,
        to : 'national.creche@gmail.com',
        subject : 'You got a new mail from visitor [' + req.body.name + ']',
        text : req.body.message
    };
    transport.sendMail(mailoptions,function(err,success) {
        if(err) {
            console.log(err);
            res.sendStatus(500);
        }  else {
            res.sendStatus(200);
        }
    });
});

module.exports = router;    