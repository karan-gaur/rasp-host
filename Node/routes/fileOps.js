const fs = require("fs");
const path = require("path");
const uuid = require("uuid/v1");
const express = require("express");

const utility = require("../utility");
const constants = require("../constants");

const router = express.Router();
const logger = constants.LOGGER;

// Root Api.
router.post("/", [utility.checkAuthentication, utility.checkFilePath], (req, res) => {
    try {
        if (fs.lstatSync(req.body.filePath).isDirectory()) {
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
            const fileSize = fs.statSync(req.body.filePath).size;
            const range = req.headers.range;

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

                const file = fs.createReadStream(req.body.filePath, { start, end });
                const head = {
                    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                    "Accept-Ranges": `bytes`,
                    "Content-Length": end - start + 1,
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
                fs.createReadStream(req.body.filePath).pipe(res);
            }
        }
    } catch (err) {
        logger.error(`Error fetching file details - '${req.body.filePath}'. Err - ${err}`);
        return res.status(500).json({ error: "Internal server error." });
    }
});

// Download files.
router.post("/download", [utility.checkAuthentication, utility.checkFilePath], async (req, res) => {
    try {
        let downloadPath = req.body.filePath;
        let isDir = fs.lstatSync(req.body.filePath).isDirectory();
        if (isDir) {
            // Directory found
            downloadPath = path.join(constants.DATA_DUMP, path.basename(req.body.filePath) + "-" + uuid() + ".zip");
            await utility.zipFolder(req.body.filePath, downloadPath);
        }

        // Downloading file (Compressed if directory)
        await res.download(downloadPath, function (downloadError) {
            if (downloadError) {
                logger.error(`Error downloading file - '${downloadPath}'. Error -  ${downloadError}`);
                return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
            } else if (isDir) {
                fs.unlinkSync(downloadPath);
                logger.info(`Deleted file after download - '${downloadPath}'`);
            }
        });
    } catch (err) {
        logger.error(`Error downloading/compressing folder - '${req.body.filePath}'. Err - ${err}`);
        return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
    }
});

// Upload files.
router.post("/upload", utility.checkAuthentication, async (req, res) => {
    try {
        // Validating params
        if (!req.files || !req.files.uploadedFile) {
            logger.error(`Missing body param - 'uploadedFile`);
            return res.status(400).json({ error: "Invalid/Missing required value - 'uploadedFile' [File]." });
        } else if (!fs.existsSync(req.body.filePath)) {
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
            let usr = await User.findOne({ email: req.body.token.email }).exec();
            if (usr) {
                // Evaluating storage
                if (usr.storage + req.files.uploadedFile.size > usr.storageLimit) {
                    logger.error(`User upload failed. Storage limit reached - '${usr.storage}/${usr.storageLimit}'`);
                    return res.status(400).json({
                        error: "User storage Limit Reached. [Values in bytes]",
                        storage: usr.storage,
                        storageLimit: usr.storageLimit,
                        fileSize: req.files.uploadedFile.size,
                    });
                }

                // Saving file to user directory
                await req.files.uploadedFile.mv(path.join(req.body.filePath, req.files.uploadedFile.name));
                logger.info(
                    `User file uploaded successfully - '${path.join(req.body.filePath, req.files.uploadedFile.name)}'`
                );

                // Updating user storage
                usr.storage += utility.getFolderSize(path.join(req.body.filePath, req.files.uploadedFile.name));
                await usr.save((saveError) => {
                    if (saveError) {
                        logger.error(`Error saving updated storage limit for '${usr.email}. Err - ${saveError}`);
                        return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
                    }
                    return res.sendStatus(200);
                });
            } else {
                logger.error(`No such user - '${req.body.token.email}`);
                return res.status(404).json({
                    error: "Invalid username/password. Please re-login",
                });
            }
        }
    } catch (err) {
        logger.error(`Error Uploading user file - ${err}`);
        return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
    }
});

// Create user file or directory
router.post("/create", utility.checkAuthentication, async (req, res) => {
    // Validating req body params
    if (typeof req.body.isFolder === "undefined" || typeof req.body.isFolder !== "boolean") {
        logger.error(`Bad value for parameter 'isFolder' in /create endpoint - '${req.body.fName}'`);
        return res.status(400).json({ error: "'isFolder' must have Boolean values - [true/false]" });
    }

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
        try {
            let usr = await User.findOne({ email: req.body.token.email }).exec();
            if (usr) {
                // Evaluating storage
                if (usr.storage >= usr.storageLimit) {
                    logger.warn(`Upload failed. Storage limit reached - '${usr.storage}/${usr.storageLimit}'`);
                    return res.status(400).json({
                        error: "User storage Limit Reached. [Values in bytes]",
                        storage: usr.storage,
                        storageLimit: usr.storageLimit,
                    });
                }
                if (req.body.isFolder) {
                    // Creating user directory
                    fs.mkdirSync(path.join(req.body.filePath, req.body.fName));
                    logger.info(`Directory created - '${path.join(req.body.filePath, req.body.fName)}'`);
                } else {
                    // Creating empty file
                    fs.appendFileSync(path.join(req.body.filePath, req.body.fName), "");
                    logger.info(`File created - '${path.join(req.body.filePath, req.body.fName)}'`);
                }
                usr.storage += utility.getFolderSize(path.join(req.body.filePath, req.body.fName));

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
        } catch (err) {
            logger.error(`Error uploading file for '${usr.email}. Err - ${saveError}`);
            return res.status(500).json({
                error: "Internal server error. Contact System Administrator",
            });
        }
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
        } else if (!fs.existsSync(path.join(req.body.filePath))) {
            // Check if file/folder with given name exists
            logger.error(`File/Directory does not exists - '${req.body.filePath}'`);
            return res.status(403).json({
                error: "Missing File/Directory - " + req.body.path.join(path.sep),
            });
        } else if (fs.existsSync(path.join(path.basename(req.body.filePath), req.body.updatedName))) {
            logger.error(
                `Directory already exists - '${path.join(req.body.path.join(path.sep), req.body.updatedName)}'`
            );
            return res.status(403).json({
                error: "File/Directory exists - " + path.join(req.body.path.join(path.sep), req.body.updatedName),
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
router.delete("/delete", utility.checkAuthentication, async (req, res) => {
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

        let usr = await User.findOne({ email: req.body.token.email }).exec();
        if (usr) {
            const fsize = utility.getFolderSize(req.body.filePath);
            fs.rmSync(req.body.filePath, { recursive: true });
            logger.info(`Deleted file/folder - '${req.body.filePath}'`);
            usr.storage -= fsize;
            await usr.save((saveError) => {
                if (saveError) {
                    logger.error(`Error updating user storage on deleting - '${req.body.filePath}. Err - ${saveError}`);
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
    } catch (err) {
        logger.error(`Error deleting file/folder - '${req.body.filePath}' - Err - ${err}`);
        return res.status(500).json({
            error: "Internal server error. Contact System Administrator",
        });
    }
});

module.exports = router;
