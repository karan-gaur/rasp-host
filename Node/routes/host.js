const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const config = require('../config');
const constants = require('../constants')
const zipFolder = require('zip-a-folder');
const getSize = require('get-folder-size');

// Root Api.
router.post('/', checkAuthentication, checkPath, function(req, res){
    selectedFile = req.body.filePath;
    console.log(selectedFile)
    if( fs.existsSync(selectedFile) && fs.lstatSync(selectedFile).isDirectory() ) {
        var files = fs.readdirSync(selectedFile);
        res.json({ title: 'Be Professional, Be Casual, Be You', files: files, selectedFile: selectedFile });
    } else {
        res.sendStatus(403);
    }
});

// Download files.
router.post('/download', checkAuthentication, checkPath, function(req, res) {
    downloadPath = req.body.filePath;
    if( fs.existsSync(downloadPath) && fs.lstatSync(downloadPath).isDirectory() ) {
        zipPath = path.dirname(__dirname) + constants.ZIP_PATH + path.basename(downloadPath) + constants.ZIP_EXTENSION;
        zipFolder.zipFolder(downloadPath, zipPath, function(zipError) {
            if(zipError) {
                console.log('oh no!', zipError);
            } else {
                res.download(zipPath, function(downloadError) {
                    if(downloadError)
                        console.log("Error in downloading file.", downloadError);
                    fs.unlink(zipPath, function(){
                        console.log("File Deleted : ",zipPath);
                    });
                });
            }
        });
    } else {
        res.download(downloadPath);
    }
});

// Upload files.
router.post('/upload', checkAuthentication, checkPath, function(req, res) {
    getSize(req.user.path, function(error, size) {
        if(error) {
            console.log("Error Uploading file", error);
            res.statusCode(500);
        } else if((size / 1024 / 1024).toFixed(2) + req.files.uploadedFile.size <= 100) {
            req.files.uploadedFile.mv(req.body.filePath + req.files.uploadedFile.name, function(err, success) {
                if(err) {
                    console.log("Error saving file to structure", error);
                    res.statusCode(500);
                }
                console.log("File saved to structure");
                res.send("Success");
            });
        } else {
            console.log("Threshold Reached");
            res.statusCode(400);
            res.send("User Save Limit Reached");
        }
    });
});

// Check for authentication.
function checkAuthentication(req, res, next) {
    if(typeof(req.headers["authorization"]) !== "undefined") {
        const token = req.headers['authorization'].split(" ")[1];
        req.body.token = jwt.verify(token, constants.SECRET_KEY);
        next();
    } else {
        console.log("3")
        res.sendStatus(403);
    }
}

// Check permission for file.
function checkPath(req, res, next) {
    const path = req.body.filePath.split(constants.FORWARD);
    const userHome = req.body.token.path.split(constants.FORWARD);
    for(var i=0; i<userHome.length; i++) {
        if(path[i] !== userHome[i]) {
            return res.sendStatus(403);
        }
    }
    next();
}

// Get File Extension.
function getFileExtension(fileName) {
    var ext = path.extname(fileName||'').split('.');
    return ext[ext.length - 1];
}

module.exports = router;
