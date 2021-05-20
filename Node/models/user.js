const mongoose = require("mongoose");
const config = require("../config");

var userSchema = new mongoose.Schema({
    email: {
        type: String,
        unique: true,
        maxLength: 256,
        required: true,
    },
    name: {
        type: String,
        maxLength: 32,
        required: true,
    },
    hash: {
        type: String,
        required: true,
    },
    path: {
        type: Array,
        required: true,
    },
    admin: {
        type: Boolean,
        default: false,
    },
    storage: {
        type: Number,
        default: 0,
    },
    storageLimit: {
        type: Number,
        default: config.USER_STORAGE_LIMIT,
    },
    devices: {
        type: Map,
        of: String,
    },
});

module.exports = mongoose.model("User", userSchema);
