const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const zipFolder = require('zip-a-folder');
const multer = require('multer');
const getSize = require('get-folder-size')

// Root Api.
router.get('/', checkAuthentication, function(req, res, next) {
    selectedFile = req.user.path;
    var files = fs.readdirSync(selectedFile);
    res.render('index', { title: 'Be Professional, Be Casual, Be You', files: files, selectedFile: selectedFile, user: req.user });
});
router.post('/', checkAuthentication, function(req, res, next){
    selectedFile = req.body.selectedFile;
    if( fs.existsSync(selectedFile) && fs.lstatSync(selectedFile).isDirectory() ) {
        var files = fs.readdirSync(selectedFile);
        res.render('index', { title: 'Be Professional, Be Casual, Be You', files: files, selectedFile: selectedFile, user: req.user });
    } else {
        res.render('')
    }
});

// Download files.
router.post('/download', checkAuthentication, function(req, res, next) {
    downloadPath = req.body.downloadPath;
    if( fs.existsSync(downloadPath) && fs.lstatSync(downloadPath).isDirectory() ) {
        zipPath = path.dirname(__dirname) + "/public/Zip/" + path.basename(downloadPath) + ".zip";
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
router.post('/upload', checkAuthentication, function(req, res, next) {
    upload = multer({ dest: 'uploads/' });
    getSize(req.user.path, function(error, size) {
        if(error) {
            console.log("Error Uploading file", error);
            res.statusCode(500);
            res.send("Internal Server Error");
        } else if((size / 1024 / 1024).toFixed(2) + req.files.uploadedFile.size < 100) {
            req.files.uploadedFile.mv(req.user.path + req.body.path + req.files.uploadedFile.name, function(err, success) {
                if(err) {
                    console.log("Error saving file to structure", error);
                    res.statusCode(400);
                    res.send("User Save Limit Reached");
                }
                console.log("File saved to structure");
                res.send("Success");
            });
        } else {
            console.log("User Save Limit Reached");
            res.statusCode(400);
            res.send("User Save Limit Reached");
        }
    });
});

// Check for authentication.
function checkAuthentication(req, res, next){
    if(req.isAuthenticated())
        return next();
    return res.redirect('/login');
}

// Get File Extension.
function getFileExtension(fileName) {
    var ext = path.extname(fileName||'').split('.');
    return ext[ext.length - 1];
}

module.exports = router;
