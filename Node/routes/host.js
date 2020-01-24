const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const uuid = require('uuid/v1');
const jwt = require('jsonwebtoken');
const config = require('../config');
const constants = require('../constants')
const zipFolder = require('zip-a-folder');
const getSize = require('get-folder-size');

// Root Api.
router.post('/', checkAuthentication, (req, res) => {
    selectedFile = req.body.filePath;
    if( !fs.existsSync(selectedFile) ) {
        res.sendStatus(403);
    } else if( fs.lstatSync(selectedFile).isDirectory() ) {
        res.json({ files: fs.readdirSync(selectedFile), selectedFile: selectedFile });
    } else {
        res.sendStatus(403);
    }
});

// Download files.
router.post('/download', checkAuthentication, async (req, res) => {
    downloadPath = req.body.filePath;
    if( !fs.existsSync(downloadPath) ) {
        res.sendStatus(404);
    } else {
        if( fs.lstatSync(downloadPath).isDirectory() ) {
            downloadPath = path.dirname(__dirname) + constants.ZIP_PATH + path.basename(downloadPath) + uuid() + constants.ZIP_EXTENSION;
            await zipFolder.zipFolder(downloadPath, downloadPath, function(zipError) {
                if(zipError) {
                    console.log('oh no!', zipError);
                } 
            });
        }
        res.download(downloadPath, function(downloadError) {
            if(downloadError) {
                console.log("Error in downloading file.", downloadError);
            } else if(downloadPath !== req.body.filePath) {
                fs.unlink(downloadPath, function(){
                    console.log("File Deleted : ", zipPath);
                });
            }
        });
    }
});

// Upload files.
router.post('/upload', checkAuthentication, (req, res) => {
    if( fs.existsSync(req.body.filePath + constants.FORWARD + req.files.uploadedFile.name) ) {
        res.sendStatus(403);
    } else {
        getSize(req.body.token.path, function(error, size) {
            if(error) {
                console.log("Error Uploading file", error);
                return res.statusCode(500);
            } else if((size / 1024 / 1024).toFixed(2) + req.files.uploadedFile.size <= 100) {
                req.files.uploadedFile.mv(req.body.filePath + constants.FORWARD + req.files.uploadedFile.name, function(err, success) {
                    if(err) {
                        console.log("Error saving file to structure", error);
                        return res.statusCode(500);
                    }
                    console.log("File saved to structure");
                    return res.send("Success");
                });
            } else {
                console.log("Threshold Reached");
                res.statusCode(400);
                return res.send("User Save Limit Reached");
            }
        });
    }
});

// Check for authentication.
function checkAuthentication(req, res, next) {
    if(typeof(req.headers["authorization"]) !== "undefined") {
        const token = req.headers['authorization'].split(" ")[1];
        req.body.token = jwt.verify(token, constants.SECRET_KEY);
        if(typeof(req.body.filePath) !== 'undefined') {
            if( !checkPath( req.body.filePath.split(constants.FORWARD), req.body.token.path.split(constants.FORWARD)))
                return res.sendStatus(403);
        }
        next();
    } else {
        return res.sendStatus(403);
    }
}

// Check permission for file.
function checkPath(path, userHome) {
    for(var i=0; i<userHome.length; i++) {
        if(path[i] !== userHome[i])
            return false;
    }
    return true;
}

// Get File Extension.
function getFileExtension(fileName) {
    var ext = path.extname(fileName||'').split('.');
    return ext[ext.length - 1];
}

module.exports = router;
