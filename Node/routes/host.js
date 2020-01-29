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
// router.post('/', checkAuthentication, (req, res) => {
router.get('/', (req, res) => {
    console.log("0")
    req.body.filepath = "/home/mr_gaur/Desktop/codeshare/10 Task 10. Go Live/10-4 Create our own Peer Server for Video Call.mp4"
    if( !fs.existsSync(req.body.filePath) ) {
        return res.sendStatus(403);
    } else if( fs.lstatSync(req.body.filePath).isDirectory() ) {
        return res.json({ files: fs.readdirSync(req.body.filePath), selectedFile: req.body.filePath });
    } else {
        const path = req.body.filepath;
        const stat = fs.statSync(req.body.filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        console.log("1", stat)

        if (range) {
            console.log("2")
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;
            
            const chunksize = (end-start) + 1;
            const file = fs.createReadStream(path, {start, end});
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            };
            console.log("3")
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            console.log("4")
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            };
            console.log("5")
            res.writeHead(200, head);
            console.log("6")
            fs.createReadStream(path).pipe(res);
            console.log("7")
        }
    }
});

// Download files.
router.post('/download', checkAuthentication, (req, res) => {
    if( !fs.existsSync(req.body.filePath) ) {
        res.sendStatus(404);
    } else if( fs.lstatSync(req.body.filePath).isDirectory() ) {
        downloadPath = path.dirname(__dirname) + constants.ZIP_PATH + path.basename(req.body.filePath) + uuid() + constants.ZIP_EXTENSION;
        zipFolder.zipFolder(req.body.filePath, downloadPath, (zipError) => {
            if(zipError) {
                console.log('oh no!\n', zipError);
                return res.sendStatus(500)
            } 
            res.download(downloadPath, function(downloadError) {
                if(downloadError) {
                    console.log("Error in downloading file.\n", downloadError);
                    return res.sendStatus(500);
                }
                fs.unlink(downloadPath, () => {
                    console.log("File Deleted : ", downloadPath);
                });            
            });
        });
    } else {
        res.download(req.body.filePath, function(downloadError) {
            if(downloadError) 
                console.log("Error in downloading file.", downloadError);
                return res.sendStatus(500);
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
