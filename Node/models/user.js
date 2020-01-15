var mongoose = require('mongoose');
var bcrypt = require('bcrypt')

var userSchema = new mongoose.Schema({
    email : {
        type : String,
        unique : true,
        required : true,
        immutable: true
    },
    name : {
        type : String,
        required : true,
    },
    hash : {
        type: String,
        required: true
    },
    path : {
        type : String,
        required : true,
        immutable : true
    }
});

userSchema.methods.setPath = function(path) {
    this.path = path;
}

userSchema.methods.setHash = function(hash) {
    this.hash = hash;
};

userSchema.methods.getHash = function(password) {
    return this.hash;
};

module.exports = mongoose.model('User',userSchema);