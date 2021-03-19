const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("./config");
const constants = require("./constants");
const logger = constants.LOGGER;

/**
 * User API authentication check.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function checkAuthentication(req, res, next) {
    if (typeof req.body === "undefined") {
        // Adding empty body for Get requests
        req.body = {};
    }
    if (typeof req.headers["authorization"] !== "undefined") {
        // Validating AUTH token
        const token = req.headers["authorization"].split(" ")[1];
        try {
            req.body.token = jwt.verify(token, config.SECRET_KEY);
        } catch (err) {
            logger.error(`Error verifying JWT from request. Err - ${err}`);
            return res.status(401).json({ error: "JWT Token unauthorised - reissue required." });
        }
        if (typeof req.body.path !== "undefined") {
            if (req.body.path.includes("..")) {
                logger.warn(`Found '..' usage in directory path - '${req.body.path}`);
                return res.status(400).json({ error: "Illegal parameter usage - '..'" });
            }
            req.body.filePath = path.join(req.body.token.path.join(path.sep), req.body.path.join(path.sep));
        }
        next();
    } else {
        // No Auth token found
        logger.warn("Missing request auth token.");
        return res.status(404).json({ error: "URL does not exists" });
    }
}

/**
 * User API authorization check.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function checkAuthorization(req, res, next) {
    if (req.body.token.admin) {
        // Check if user has privilege admin access
        logger.info(
            `User authorized access - '/status' - {'user':'${req.body.token.email}', 'admin':'${req.body.token.admin}}`
        );
        next();
    } else {
        logger.error(
            `Unauthorized access - '/status' - {'user':'${req.body.token.email}', 'admin':'${req.body.token.admin}}`
        );
        return res.status(404).json({ error: "URL does not exists" });
    }
}

/**
 * Verify user password for additional security.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function verifyPassword(req, res, next) {
    if (typeof req.body.password === "undefined") {
        logger.error(`Missing parameter 'password' for verifyPassword with token email - '${req.body.token.email}'`);
        return res.status(400).json({ error: "Missing paramter in request body - 'password'." });
    }

    try {
        // Verifying user password
        User.findOne({ email: req.body.token.email }).then((usr) => {
            if (usr) {
                // User Exists
                bcrypt.compare(req.body.password, usr.hash).then((resolve) => {
                    if (!resolve) {
                        // Invalid Password
                        logger.info(`Invalid Password for - '${req.body.email}'`);
                        return res.status(401).json({ error: "Invalid username/password" });
                    } else {
                        // Login Successful
                        logger.info(`User password verfied - '${req.body.email}'`);
                        next();
                    }
                });
            } else {
                // No such user
                logger.info(`No user with username - '${req.body.email}'`);
                return res.status(401).json({ error: "Invalid username/password" });
            }
        });
    } catch (err) {
        logger.error(`Error verifying user password - '${req.body.token.email}' - Err - ${err}`);
        return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
    }
}

/**
 * Evaluate folder size in Bytes
 * @param {String} dirPath
 * @throws Will throw an error if file does not exists
 * @returns {number}
 */
function getFolderSize(dirPath) {
    if (!fs.existsSync(dirPath)) {
        throw `No such file/folder - '${dirPath}'`;
    }
    stats = fs.lstatSync(dirPath);
    if (stats.isFile()) return stats.size;

    fileArray = fs.readdirSync(dirPath);
    totalFolderSize = stats.size;

    fileArray.forEach((file) => {
        stats = fs.lstatSync(path.join(dirPath, file));
        if (stats.isDirectory()) totalFolderSize += getFolderSize(path.join(dirPath, file));
        else totalFolderSize += stats.size;
    });
    return totalFolderSize;
}

/**
 * Get extenstion of the given file.
 * @param {string} fileName Name of the file.
 * @returns {string}
 */
function getFileExtension(fileName) {
    var ext = path.extname(fileName || "").split(".");
    return ext[ext.length - 1];
}

module.exports = {
    checkAuthentication: checkAuthentication,
    checkAuthorization: checkAuthorization,
    verifyPassword: verifyPassword,
    getFolderSize: getFolderSize,
    getFileExtension: getFileExtension,
};
