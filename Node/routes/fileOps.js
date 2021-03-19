const fs = require("fs");
const path = require("path");
const uuid = require("uuid/v1");
const express = require("express");
const zipFolder = require("zip-a-folder");

const config = require("../config");
const utility = require("../utility");
const constants = require("../constants");

const router = express.Router();
const logger = constants.LOGGER;

// Root Api.
router.post("/", utility.checkAuthentication, (req, res) => {
    if (!fs.existsSync(req.body.filePath)) {
        // Directory does not exists
        logger.error(`No such file/folder exists - ${req.body.filePath}`);
        return res.status(400).json({
            error: "No such file/folder exists - " + req.body.path.join(path.sep),
        });
    } else if (fs.lstatSync(req.body.filePath).isDirectory()) {
        logger.info(`Reading directory details for '${req.body.token.email}' - ${req.body.filePath}`);
        dirContents = fs.readdirSync(req.body.filePath);
        files = [];
        folders = [];

        // Segregating files and folders in directory
        dirContents.forEach((file) => {
            stats = fs.lstatSync(path.join(req.body.filePath, file));
            if (stats.isDirectory()) {
                folders.push({
                    name: file,
                    size: utility.getFolderSize(path.join(req.body.filePath, file)),
                    mt: stats.mtime,
                });
            } else {
                files.push({
                    name: file,
                    size: stats.size,
                    mt: stats.mtime,
                });
            }
        });
        return res.status(200).json({
            files: files,
            folders: folders,
            selectedFile: req.body.path,
        });
    } else {
        // Path points to file
        logger.info(`Streaming video - '${req.body.filePath}`);
        const path = req.body.filePath;
        const stat = fs.statSync(req.body.filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            const chunksize = end - start + 1;
            const file = fs.createReadStream(path, { start, end });
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
    if (!fs.existsSync(req.body.filePath)) {
        // File or Folder does not exist
        logger.error(`No such file - '${req.body.filePath}'`);
        return res.status(404).json({
            error: "No such file exists -" + req.body.path.join(path.sep),
        });
    } else if (fs.lstatSync(req.body.filePath).isDirectory()) {
        // Directory found
        downloadPath = constants.ZIP_PATH + path.basename(req.body.filePath) + uuid() + ".zip";
        zipFolder.zipFolder(req.body.filePath, downloadPath, (zipError) => {
            if (zipError) {
                // Error compressing file
                logger.error(`Error compressing folder - '${req.body.filePath}'. Err - ${zipError}`);
                return res.status(500).json({ error: "Internal server error." });
            }
            res.download(downloadPath, function (downloadError) {
                if (downloadError) {
                    // Error downloading file
                    logger.error(`Error downloading file - '${downloadPath}'. Error - '${downloadError}'`);
                    return res.status(500).json({ error: "Internal server error." });
                }
                fs.unlink(downloadPath, () => {
                    // Deleting compressed file after download
                    logger.info(`Deleted file after download - '${donwloadPath}'`);
                });
            });
        });
    } else {
        // Single file found - Not being compressed
        res.download(req.body.filePath, function (downloadError) {
            if (downloadError) {
                logger.error(`Error downloading file - '${downloadPath}'. Error -  ${downloadError}`);
                return res.status(500).json({ error: "Internal server error." });
            }
        });
    }
});

// Upload files.
router.post("/upload", utility.checkAuthentication, (req, res) => {
    try {
        if (!fs.existsSync(req.body.filePath)) {
            // Check if parent directory exists
            logger.error(`Parent directory does not exists - '${req.body.filePath}'`);
            return res.status(403).json({
                error: "Missing parent directory - " + req.body.path.join(path.sep),
            });
        } else if (fs.existsSync(path.join(req.body.filePath, req.files.uploadedFile.name))) {
            // File with similar name already exists
            logger.error(
                `File with name - '${path.join(req.body.filePath, req.files.uploadedFile.name)}' already exists`
            );
            return res.status(403).json({ error: "File with similar name already exists!" });
        } else {
            User.findOne({ email: req.body.token.email }).then((usr) => {
                if (usr) {
                    // Evaluating storage
                    if (usr.storage + req.files.uploadedFile.size > usr.storageLimit) {
                        logger.error(
                            `User upload failed. Storage limit reached - '${usr.storage}/${usr.storageLimit}'`
                        );
                        return res.status(400).json({
                            error: "User storage Limit Reached. [Values in bytes]",
                            storage: user.storage,
                            storageLimit: user.storageLimit,
                            fileSize: req.files.uploadedFile.size,
                        });
                    }

                    // Saving file to user directory
                    req.files.uploadedFile.mv(path.join(req.body.filePath, req.files.uploadedFile.name), (err) => {
                        if (err) {
                            logger.error(`Error saving file to structure at '${filePath}'. Error - '${error}`);
                            return res.status(500).json({
                                error: "Internal server error. Contact System Administrator",
                            });
                        }
                        logger.info(
                            `User file uploaded successfully - '${path.join(
                                req.body.filePath,
                                req.files.uploadedFile.name
                            )}'`
                        );

                        // Updating user storage
                        usr.storage += utility.getFolderSize(path.join(req.body.filePath, req.files.uploadedFile.name));
                        usr.save((saveError) => {
                            if (saveError) {
                                logger.error(
                                    `Error saving updated storage limit for '${usr.email}. Err - ${saveError}`
                                );
                                return res
                                    .status(500)
                                    .json({ error: "Internal server error. Contact System Administrator" });
                            }
                            return res.sendStatus(200);
                        });
                    });
                } else {
                    loggger.error(`No such user - '${req.body.token.email}`);
                    return res.status(404).json({
                        error: "Invalid username/password. Please re-login",
                    });
                }
            });
        }
    } catch (err) {
        logger.error(`Error Uploading user file - ${err}`);
        return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
    }
});

// Create user file or directory
router.post("/create", utility.checkAuthentication, (req, res) => {
    if (!fs.existsSync(req.body.filePath)) {
        logger.error(`Parent directory does not exists - '${req.body.filePath}`);
        return res.status(403).json({
            error: "Missing parent directory - " + req.body.path.join(path.sep),
        });
    } else if (fs.existsSync(path.join(req.body.filePath, req.body.fName))) {
        // File with similar name already exists
        logger.error(`File with name - '${path.join(req.body.filePath, req.body.fName)}' already exists`);
        return res.status(403).json({ error: "File/Folder with similar name already exists!" });
    } else {
        User.findOne({ email: req.body.token.email }).then((usr) => {
            if (err) {
                logger.error(`Error communicating with database - '${err}'`);
                return res.status(500).json({
                    error: "Internal server error. Contact System Administrator",
                });
            } else if (usr) {
                // Evaluating storage
                if (usr.storage >= usr.storageLimit) {
                    logger.warn(`User upload failed. Storage limit reached - '${usr.storage}/${usr.storageLimit}'`);
                    return res.status(400).json({
                        error: "User storage Limit Reached. [Values in bytes]",
                        storage: usr.storage,
                        storageLimit: usr.storageLimit,
                    });
                }
                try {
                    if (req.body.isFolder.toUpperCase() === "TRUE") {
                        // Creating user direcoty
                        fs.mkdirSync(path.join(req.body.filePath, req.body.fName));
                        logger.info(`Directory created - '${path.join(req.body.filePath, req.body.fName)}'`);
                    } else if (req.body.isFolder.toUpperCase() === "FALSE") {
                        // Creating empty file
                        fs.appendFileSync(path.join(req.body.filePath, req.body.fName), "");
                        logger.info(`File created - '${path.join(req.body.filePath, req.body.fName)}'`);
                    } else {
                        logger.warn(`Bad value for parameter 'isFolder' in /create endpoint - '${req.body.fName}'`);
                        return res.status(422).json({ error: "'isFolder' must have values - TRUE/FALSE" });
                    }
                    usr.storage += utility.getFolderSize(path.join(req.body.filePath, req.body.fName));
                } catch (err) {
                    logger.error(`Error saving updated storage limit for '${usr.email}. Err - ${saveError}`);
                    return res.status(500).json({
                        error: "Internal server error. Contact System Administrator",
                    });
                }
                usr.save((saveError) => {
                    if (saveError) {
                        logger.error(`Error saving updated storage limit for '${usr.email}. Err - ${saveError}`);
                        return res.status(500).json({
                            error: "Internal server error. Contact System Administrator",
                        });
                    }
                    return res.sendStatus(200);
                });
            } else {
                loggger.error(`No such user - '${req.body.token.email}`);
                return res.status(404).json({
                    error: "Invalid username/password. Please re-login",
                });
            }
        });
    }
});

// Rename user file or directory
router.post("/rename", utility.checkAuthentication, (req, res) => {
    try {
        if (req.body.path.length == 0) {
            logger.error(`Cannot update user root directory - '${req.body.filePath}'`);
            return res.status(403).json({
                error: "Cannot update user's root direcotry - " + req.body.path.join(path.sep),
            });
        }
        if (!fs.existsSync(path.join(req.body.filePath))) {
            // Check if parent directory exists
            logger.error(`Parent directory does not exists - '${req.body.filePath}'`);
            return res.status(403).json({
                error: "Missing parent directory - " + req.body.path.join(path.sep),
            });
        } else if (fs.existsSync(path.join(path.basename(req.body.filePath), req.body.updatedName))) {
            logger.error(
                `Directory already exists - '${path.join(req.body.path.join(path.sep), req.body.updatedName)}'`
            );
            return res.status(403).json({
                error: "Directory exists - " + path.join(req.body.path.join(path.sep), req.body.updatedName),
            });
        }
        fs.renameSync(req.body.filePath, path.join(path.dirname(req.body.filePath), req.body.updatedName));
        logger.info(
            `Renamed '${req.body.filePath}' TO '${path.join(path.dirname(req.body.filePath), req.body.updatedName)}'`
        );
    } catch (err) {
        logger.error(`Renaming failed - '${req.body.filePath}'. Err - ${err}`);
        return res.status(500).json({
            error: "Internal server error. Contact System Administrator",
        });
    }
    return res.sendStatus(200);
});

// Delete user file or directory
router.delete("/delete", utility.checkAuthentication, (req, res) => {
    try {
        if (!fs.existsSync(req.body.filePath)) {
            logger.warn(`Delete failed. Missing directory - '${req.body.filePath}`);
            return res.status(404).json({ error: "Missing directory - " + req.body.path.join(path.sep) });
        } else if (req.body.path.length == 0) {
            logger.warn(`Cannot delete root user directory - '${req.body.filePath}'`);
            return res.status(403).json({
                error: "Cannot delete user's root directory -" + req.body.path.join(path.sep),
            });
        }

        User.findOne({ email: req.body.token.email }).then((usr) => {
            if (err) {
                logger.error(`Error connecting with database - '${err}'`);
                return res.status(500).json({
                    error: "Internal server error. Contact System Administrator",
                });
            } else if (usr) {
                const fsize = utility.getFolderSize(req.body.filePath);
                fs.rmSync(req.body.filePath, { recursive: true });
                logger.info(`Deleted file/folder - '${req.body.filePath}'`);
                usr.storage -= fsize;
                usr.save((saveError) => {
                    if (saveError) {
                        logger.error(
                            `Error updating user storage on deleting - '${req.body.filePath}. Err - ${saveError}`
                        );
                        return res.status(500).json({
                            error: "Internal server error. Contact System Administrator",
                        });
                    } else {
                        logger.info(`Freed storage for '${req.body.filePath}`);
                        return res.sendStatus(200);
                    }
                });
            } else {
                loggger.error(`No such user - '${req.body.token.email}`);
                return res.status(404).json({
                    error: "Invalid username/password. Please re-login",
                });
            }
        });
    } catch (err) {
        logger.error(`Error deleting file/folder - '${req.body.filePath}' - Err - ${err}`);
        return res.status(500).json({
            error: "Internal server error. Contact System Administrator",
        });
    }
});

module.exports = router;
