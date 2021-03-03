const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const uuid = require("uuid/v1");
const constants = require("../constants");
const zipFolder = require("zip-a-folder");
const config = require("../config");
const utility = require('../utility');
const logger = constants.LOGGER


// Root Api.
router.post("/", utility.checkAuthentication, (req, res) => {
    if( !fs.existsSync(req.body.filePath) ) {
        // Directory does not exists
        logger.info(`No such folder exists - ${req.body.filePath}`);
        return res.status(403).json({"error": "No such folder exists - " + req.body.path.join(path.sep)});
    } else if( fs.lstatSync(req.body.filePath).isDirectory() ) {
        logger.info(`Reading directory details for '${req.body.token.email}' - ${req.body.filePath}`);
        dirContents = fs.readdirSync(req.body.filePath)
        files = []
        folder = []
        
        // Segregating files and folders in directory
        dirContents.forEach((file) => {
            fs.lstatSync(path.join(req.body.filePath, file) ).isDirectory() ? folder.push(file) : files.push(file);
        });
        return res.status(200).json({ files: files, folder: folder, selectedFile: req.body.filePath });
    } else {
        // Path points to file
        logger.info(`Streaming video - '${req.body.filePath}`)
        const path = req.body.filePath;
        const stat = fs.statSync(req.body.filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if(range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;
            
            const chunksize = (end-start) + 1;
            const file = fs.createReadStream(path, {start, end});
            const head = {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": `bytes`,
                "Content-Length": chunksize,
                "Content-Type": `video/mp4`,
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                "Content-Length": fileSize,
                "Content-Type": "video/mp4",
            };
            res.writeHead(200, head);
            fs.createReadStream(path).pipe(res);
        }
    }
});


// Download files.
router.post("/download", utility.checkAuthentication, (req, res) => {    
    if( !fs.existsSync(req.body.filePath) ) {
        // File or Folder does not exist
        logger.info(`No such file - '${req.body.filePath}'`)
        return res.status(404).json({"error": "No such file exists -" + req.body.path.join(path.sep)});
    } else if( fs.lstatSync(req.body.filePath).isDirectory() ) {
        // Directory found
        downloadPath = constants.ZIP_PATH + path.basename(req.body.filePath) + uuid() + ".zip";
        zipFolder.zipFolder(req.body.filePath, downloadPath, (zipError) => {
            if(zipError) {
                // Error compressing file
                logger.error(`Error compressing folder - '${req.body.filePath}'. Err - ${zipError}`);
                return res.status(500).json({"error": "Internal server error."});
            } 
            res.download(downloadPath, function(downloadError) {
                if(downloadError) {
                    // Error downloading file
                    logger.error(`Error downloading file - '${downloadPath}'. Error - '${downloadError}'`);
                    return res.status(500).json({"error": "Internal server error."});
                }
                fs.unlink(downloadPath, () => {
                    // Deleting compressed file after download
                    logger.info(`Deleting file after download - '${donwloadPath}'`)
                });            
            });
        });
    } else {
        // Single file found - Not being compressed
        res.download(req.body.filePath, function(downloadError) {
            if(downloadError) {
                logger.error(`Error downloading file - '${downloadPath}'. Error -  ${downloadError}`);
                return res.status(500).json({"error": "Internal server error."});
            }
        });
    }
});


// Upload files.
router.post("/upload", utility.checkAuthentication, (req, res) => {
    if( !fs.existsSync(req.body.filePath) ) {
        // Check if parent directory exists
        logger.warn(`Parent directory does not exists - '${req.body.filePath}'`);
        return res.status(403).json({"error": "Missing parent directory"});
    } else if( fs.existsSync(path.join(req.body.filePath, req.files.uploadedFile.name)) ) {
        // File with similar name already exists
        logger.info(`File with name - '${path.join(req.body.filePath, req.files.uploadedFile.name)}' already exists`);
        return res.status(403).json({"error": "File with similar name already exists!"});
    } else {
        User.findOne({email: req.body.token.email}, (err, user) => {
            if(err) {
                logger.info(`Error communicating with database - '${err}'`);
                return res.status(500).json({"error": "Internal server error. Contact System Administrator"});
            } else if(user) {
                // Evaluating storage
                if( user.storage + req.files.uploadedFile.size > user.storageLimit ) {
                    logger.warn(`User upload failed. Storage limit reached - '${user.storage}/${user.storageLimit}'`);
                    return res.status(400).json({
                        "error": "User storage Limit Reached. [Values in bytes]",
                        "storage": user.storage,
                        "storageLimit": user.storageLimit,
                        "fileSize": req.files.uploadedFile.size
                    });
                }
                // Saving file to user directory
                req.files.uploadedFile.mv(path.join(req.body.filePath, req.files.uploadedFile.name), (err) => {
                    if(err) {
                        logger.error(`Error saving file to structure at '${filePath}'. Error - '${error}`);
                        return res.status(500).json({"error": "Internal server error. Contact System Administrator"});
                    }
                    logger.info(`User file uploaded successfully - '${req.body.filePath}'`);
                    return res.sendStatus(200);
                });
            } else {
                loggger.info(`No such user - '${req.body.token.email}`);
                return res.status(404).json({"error": "Invalid username/password. Please re-login"}); 
            }
        });
    }
});


// Update user storage limit
router.post("/storageLimit", utility.checkAuthentication, (req, res) => {
    if(req.body.token.admin) {
        User.findOne({email: req.body.email}, (err, usr)=> {
            if(err) {
                logger.error(`Error querring DB - '${err}`);
                return res.status(500).json({"error": "Internal server error. Contact System Administrator"});
            } else if(usr) {
                logger.info(`Updating (${usr.email}) storage limit ${usr.storageLimit}=>${req.body.storageLimit}`);
                usr.storageLimit = req.body.storageLimit;
                usr.save( (saveError) => {
                    if(saveError) {
                        logger.info(`Error saving updated storage limit for '${usr.email}. Err - ${saveError}`);
                        return res.status(500).json({"error": "Internal server error. Contact System Administrator"});
                    } 
                    return res.sendStatus(200);
                });
                return res.status(200);
            } else {

            }
        });
    } else {
        logger.warn(`Non-admin user tried updating user storage - '${req.body.token.email}`);
        return res.status(401).json({"error": "Unauthorized user. Admin credentials required."});
    }
});


module.exports = router;
