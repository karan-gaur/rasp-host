const LocalStrategy = require('passport-local').Strategy
const passport = require('passport');
const bcrypt = require('bcrypt');

passport.use(new LocalStrategy( {usernameField: 'email', passwordField: 'password'},
    function(emails, password, done) {
        User.findOne({ email: emails }, async function (err, user) {
            if (err) {
                return done(err); 
            } else if (!user) {
                return done(null, false, { message: 'Email does not exists' }); 
            } else {
                await bcrypt.compare(password, user.getHash()).then( function(resolve) {
                    if(!resolve) {
                        return done(null, false, { message: 'Incorrect Password' });
                    } else {
                        return done(null, user);
                    }
                });
            }
        });
    }
));
passport.serializeUser( function(user,done) {
    return done(null, user.id)
});
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        return done(err, user);
    });
});