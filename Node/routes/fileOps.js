const fs = require("fs");
const util = require("util");
const path = require("path");
const uuid = require("uuid/v4");
const express = require("express");

const config = require("../config");
const constants = require("../constants");
const utility = require("../utilities/utility");
const futility = require("../utilities/fileUtility");
const check = require("../utilities/validationUtility");

const router = express.Router();
const logger = constants.LOGGER;

const lstat = util.promisify(fs.lstat);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

// Root Api
router.post("/", [utility.checkAuthentication, check.checkFilePath], async (req, res) => {
    try {
        if ((await lstat(req.body.filePath)).isDirectory()) {
            let resourceInfo = await futility.getFodlerStats(req.body.filePath);
            resourceInfo["selectedFile"] = req.body.path;
            return res.status(200).send(resourceInfo);
        }

        let extension = futility.getFileExtension(req.body.filePath);

        if (extension === "txt" && futility.getFolderSize(req.body.filePath) <= config.MAX_FILE_SIZE_FOR_EDIT) {
            if (req.body.write) {
                if (typeof req.body.fileData !== "string") {
                    logger.info(`Invalid body param 'fileData' - { 'fileData': '${req.body.fileData}' }`);
                    return res
                        .status(400)
                        .json({ error: `Invalid body param 'fileData' - '${req.body.fileData}' [Exp String]` });
                }
                await writeFile(req.body.filePath, req.body.fileData);
                logger.info(`Updated contents of ${req.body.filePath} by ${req.body.token.email}`);
                return res.sendStatus(200);
            } else {
                res.status(200).json({ fileData: await readFile(req.body.filePath, "utf8") });
                logger.info(`Read file ${req.body.filePath} by ${req.body.token.email}`);
                return;
            }
        } else if (extension in config.STREAM_SUPPORTED_EXTENSIONS) {
            // Path points to streamable file
            logger.info(`Streaming multimedia file - '${req.body.filePath}`);
            const fileSize = (await lstat(req.body.filePath)).size;
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
                    "Content-Type": `${config.STREAM_SUPPORTED_EXTENSIONS[extension]}`,
                };
                res.writeHead(206, head);
                file.pipe(res);
            } else {
                const head = {
                    "Content-Length": fileSize,
                    "Content-Type": `${config.STREAM_SUPPORTED_EXTENSIONS[extension]}`,
                };
                res.writeHead(200, head);
                fs.createReadStream(req.body.filePath).pipe(res);
            }
        } else {
            // Downloading file
            res.download(req.body.filePath, (downloadError) => {
                if (downloadError) {
                    logger.error(`Error downloading file - '${filePath}'. Error -  ${downloadError}`);
                    return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
                }
                logger.info(`Downloaded file ${filePath}`);
            });
            return res.sendStatus(200);
        }
    } catch (err) {
        console.log(err);
        logger.error(`Error fetching file details - '${req.body.filePath}'. Err - ${err}`);
        return res.status(500).json({ error: "Internal server error." });
    }
});

// Download files
router.post("/download", [utility.checkAuthentication, check.checkFilePath], async (req, res) => {
    try {
        let downloadPath = req.body.filePath;
        let isDir = fs.lstatSync(req.body.filePath).isDirectory();
        if (isDir) {
            // Directory found
            downloadPath = path.join(constants.DATA_DUMP, path.basename(req.body.filePath) + "-" + uuid() + ".zip");
            await futility.zipFolder(req.body.filePath, downloadPath);
        }
        // Downloading file (Compressed if directory)
        return res.download(downloadPath, (downloadError) => {
            if (isDir) {
                fs.unlinkSync(downloadPath);
                logger.info(`Deleted file after download - '${downloadPath}'`);
            }
            if (downloadError) {
                logger.error(`Error downloading file - '${downloadPath}'. Error -  ${downloadError}`);
                if (!res.headersSent)
                    return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
            } else {
                logger.info(`Downloaded file ${downloadPath}`);
            }
        });
    } catch (err) {
        logger.error(`Error downloading/compressing folder - '${req.body.filePath}'. Err - ${err}`);
        return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
    }
});

// Upload files
router.post(
    "/upload",
    [utility.checkAuthentication, check.checkFilePath, check.verifyUploadedFile],
    async (req, res) => {
        try {
            // Checking if file_name is unique
            if (fs.existsSync(path.join(req.body.filePath, req.files.uploadedFile.name))) {
                logger.error(`File already exists - '${path.join(req.body.filePath, req.files.uploadedFile.name)}'`);
                return res.status(403).json({ error: "File with similar name already exists!" });
            }

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
                usr.storage += futility.getFolderSize(path.join(req.body.filePath, req.files.uploadedFile.name));
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
        } catch (err) {
            logger.error(`Error Uploading user file - ${err}`);
            return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
        }
    }
);

// Create user file or directory
router.post(
    "/create",
    [utility.checkAuthentication, check.checkFilePath, check.verifyFileName, check.verifyIsFolder],
    async (req, res) => {
        try {
            // Checking if file_name is unique
            if (fs.existsSync(path.join(req.body.filePath, req.body.fName))) {
                logger.error(`File with name - '${path.join(req.body.filePath, req.body.fName)}' already exists`);
                return res.status(403).json({ error: "File/Folder with similar name already exists!" });
            }

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
                    return res.sendStatus(200);
                } else {
                    // Creating empty file
                    fs.appendFileSync(path.join(req.body.filePath, req.body.fName), "");
                    logger.info(`File created - '${path.join(req.body.filePath, req.body.fName)}'`);
                    usr.storage += futility.getFolderSize(path.join(req.body.filePath, req.body.fName));

                    usr.save((saveError) => {
                        if (saveError) {
                            logger.error(`Error saving updated storage limit for '${usr.email}. Err - ${saveError}`);
                            return res.status(500).json({
                                error: "Internal server error. Contact System Administrator",
                            });
                        }
                        return res.sendStatus(200);
                    });
                }
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
);

// Rename user file or directory
router.post(
    "/rename",
    [utility.checkAuthentication, check.checkFilePath, check.verifyFileName, check.rootDirChanges],
    (req, res) => {
        try {
            const newFileName = path.join(path.dirname(req.body.filePath), req.body.fName);
            if (fs.existsSync(newFileName)) {
                logger.error(`Directory already exists - '${newFileName}'`);
                return res.status(403).json({ error: `File/Directory exists with similar name - '${newFileName}'` });
            }
            fs.renameSync(req.body.filePath, newFileName);
            logger.info(`Renamed '${req.body.filePath}' TO '${newFileName}'`);
            return res.sendStatus(200);
        } catch (err) {
            logger.error(`Renaming failed - '${req.body.filePath}'. Err - ${err}`);
            return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
        }
    }
);

// Delete user file or directory
router.delete("/delete", [utility.checkAuthentication, check.checkFilePath, check.rootDirChanges], async (req, res) => {
    try {
        let usr = await User.findOne({ email: req.body.token.email }).exec();
        if (usr) {
            const fsize = futility.getFolderSize(req.body.filePath);
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
