const express = require('express');
const { check , validationResult } = require('express-validator');
const router = express.Router();

const passport = require('passport');
const initializePassport = require('../passport')
const bcrypt = require('bcrypt');


// Login API.
router.get("/login", checkNotAuthentication, function(req, res, next){
    res.render('login', {title: 'Custom Cloud'} );
});
router.post("/login", checkNotAuthentication, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));

// Register new Account.
router.get('/register', checkNotAuthentication, function(req, res, next) {
    res.render('register', { title: 'Register New Account.' });
});
router.post('/register', checkNotAuthentication, [
    check('name','Empty Name').not().isEmpty(),
    check('email','Enter a valid Email Address').isEmail(),
    check('password','Empty Password').not().isEmpty()
], function(req, res, next) {
    var errors = validationResult(req);
    if(req.body.password != req.body.confirmPassword) {
        errors.errors.push({msg: 'Password and Confirm Password do not match', param: 'confirmPassword'})
    }
    if(errors.errors.length > 0) {
        res.render('register', {
            title : 'Register New Account.',
            name : req.body.name,
            email : req.body.email,
            errorMessages : errors.errors
        });
    } else {
        var user = new User();
        user.name = req.body.name;
        user.email = req.body.email;
        user.setPath(req.body.email.replace(/\s/g,''));
        bcrypt.hash(req.body.password,10).then( function(hashPwd) {
            user.setHash(hashPwd);
            user.save(function(saveError) {
                if(saveError) {
                    res.render('register', {
                        title : 'Register New Account.',
                        name : req.body.name,
                        errorMessages : [{msg :  "Email Already Taken"}]
                    });
                } else {
                    res.redirect('/login');
                }
            });
        });
    }
});

// Logout User from session.
router.get('/logout', function(req, res) {
    req.logOut();
    res.redirect('/login');
})

// Check for authentication.
function checkNotAuthentication(req, res, next){
    if(req.isAuthenticated())
        return res.redirect('/');
    return next();
}

module.exports = router;    