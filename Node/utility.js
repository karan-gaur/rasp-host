const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const config = require("./config")
const constants = require("./constants");
const logger = constants.LOGGER


/**
 * User API authentication check.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function checkAuthentication(req, res, next) {
    if(typeof(req.headers["authorization"]) !== "undefined") {
        // Validating AUTH token
        const token = req.headers["authorization"].split(" ")[1];
        try {
            req.body.token = jwt.verify(token, config.SECRET_KEY);
        } catch(err) {
            logger.error(`Error verifying JWT from request. Err - ${err}`)
            return res.status(401).json({"error": "JWT Token unauthorised - reissue required."});
        }
        if(typeof(req.body.path) !== "undefined") {
            if( req.body.path.includes("..")) {
                logger.warn(`Found '..' usage in directory path - '${req.body.path}`);
                return res.status(400).json({"error": constants.GUIDELINES});
            }
            req.body.filePath = path.join(req.body.token.path.join(path.sep), req.body.path.join(path.sep));
        }
        next();
    } else {
        // No Auth token found
        logger.warn("Missing request auth token.");
        return res.status(403).json({"error": "Missing auth token. Login again."});
    }
}


/**
 * Evaluate folder size in Bytes
 * @param {String} dirPath
 * @throws Will throw an error if file does not exists
 * @returns {number}
 */
function getFolderSize(dirPath) {
    if(!fs.existsSync(dirPath)) {
        throw `No such file/folder - '${dirPath}'`;
    } else if(fs.lstatSync(dirPath).isFile()) {
        return fs.statSync(dirPath).size;
    }

    files = fs.readdirSync(dirPath);
    totalFolderSize = 0

    files.forEach((file) => {
        if(fs.lstatSync(path.join(dirPath, file)).isDirectory()) {
            totalFolderSize += getFolderSize(path.join(dirPath, file));
        } else {
            totalFolderSize += fs.statSync(path.join(dirPath, file)).size;
        }
    });
    return totalFolderSize;
}


/**
 * Get extenstion of the given file.
 * @param {string} fileName Name of the file.
 * @returns {string}
 */
function getFileExtension(fileName) {
    var ext = path.extname(fileName||"").split(".");
    return ext[ext.length - 1];
}

module.exports = { 
    checkAuthentication : checkAuthentication,
    getFolderSize : getFolderSize,
    getFileExtension : getFileExtension
}
