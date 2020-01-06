var express = require('express');
var { check , validationResult } = require('express-validator');
var router = express.Router();

var nodeMailer = require('nodemailer');
var config = require('../config');
var transport = nodeMailer.createTransport(config.mailer);


/* GET "About Us" page. */
router.get('/about', function(req, res, next){
    res.render('about', {title: 'Be Professional, Be Casual, Be YOU'});
});

/* GET "Contact Us" page. */
router.get("/contact", function(req, res, next){
    res.render('contact',{ title: 'Be Professional, Be Casual, Be YOU'});
})
router.post("/contact", [
    check('name').not().isEmpty().withMessage("Name Cannot be empty"),
    check('email').isEmail().withMessage("Please Enter Email"),
    check('message').isLength({min:10}).withMessage("Message must be atlease 10 letters"),
], function(req, res, next) {
    var errors = validationResult(req);
    if(!errors.isEmpty()) {
        res.render('contact',{
            title : 'Be Professional, Be Casual, Be YOU',
            name : req.body.name,
            email : req.body.email,
            message : req.body.message,
            errorMessages : errors.array()
        });
    } 
    else {
        var mailoptions = {
            from : 'Code4Share <no-reply@code4share.com>',
            to : 'national.creche@gmail.com',
            subject : 'You got a new mail from visitor [' + req.body.name + ']',
            text : req.body.message
        };

        transport.sendMail(mailoptions,function(err,res){
            if(err)
            console.log(err);
        });
        res.render('thanks',{ title: 'Be Professional, Be Casual, Be YOU' });
    };
});

/* GET "Thank You" page. */
router.get("/thanks", function(req, res, next){
  res.render("thanks", {title: 'Thanks'});
});

module.exports = router;