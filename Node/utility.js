const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const archiver = require("archiver");
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
            req.body.token = jwt.verify(token, config.ACCESS_TOKEN_SECRET_KEY);
        } catch (err) {
            logger.error(`Error validating JWT from request. Err - ${err}`);
            return res.status(401).json({ error: "JWT Token unauthorised - reissue required." });
        }
        if (typeof req.body.path !== "undefined") {
            if (req.body.path.includes("..")) {
                logger.warn(`Found '..' usage in directory path - '${req.body.path}`);
                return res.status(400).json({ error: "Illegal parameter usage - '..'" });
            }
            req.body.filePath = path.join(req.body.token.path.join(path.sep), req.body.path.join(path.sep));
        } else {
            req.body.path = [];
        }
        next();
    } else {
        // No Auth token found
        logger.warn("Missing request auth token.");
        return res.status(404).json({ error: "URL does not exists" });
    }
}

/**
 * Check if given file exists for user.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function checkFilePath(req, res, next) {
    if (typeof req.body.filePath !== "string" || !fs.existsSync(req.body.filePath)) {
        // Directory does not exists
        logger.warn(`No such file/folder exists - ${req.body.filePath}`);
        return res.status(400).json({ error: "No such file/folder exists - '" + req.body.path.join(path.sep) + "'" });
    }
    next();
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
        logger.info(`Authorized access - {'user':'${req.body.token.email}', 'admin':'${req.body.token.admin}}`);
        next();
    } else {
        logger.warn(`Unauthorized access - {'user':'${req.body.token.email}', 'admin':'${req.body.token.admin}}`);
        return res.status(404).json({ error: "URL does not exists" });
    }
}

/**
 * Verify user password for additional security.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
async function verifyPassword(req, res, next) {
    if (typeof req.body.password !== "string") {
        logger.info(`Missing parameter 'password' in verifyPassword for email - '${req.body.token.email}'`);
        return res
            .status(400)
            .json({ error: "Invalid/Missing paramter 'password' - '" + req.body.password + "'. Must be string" });
    }

    try {
        // Verifying user password
        const usr = await User.findOne({ email: req.body.token.email }).exec();
        if (usr) {
            // User Exists
            await bcrypt.compare(req.body.password, usr.hash).then((resolve) => {
                if (!resolve) {
                    // Invalid Password
                    logger.warn(`Invalid Password for - '${req.body.email}'`);
                    return res.status(401).json({ error: "Invalid username/password" });
                } else {
                    // Login Successful
                    logger.info(`User password verfied - '${req.body.token.email}'`);
                    next();
                }
            });
        } else {
            // No such user
            logger.info(`No user with username - '${req.body.email}'`);
            return res.status(401).json({ error: "Invalid username/password" });
        }
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
 * Validates if given string is an email.
 * @param {String} email
 * @returns {Boolean} True if email is vald
 */
function validateEmail(email) {
    if (email.length < 6 || email.length > 256) return false;
    const re =
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

/**
 * Compress folders and save to local directory
 * @param {string} srcFolder
 * @param {string} zipFilePath
 * @returns
 */
function zipFolder(srcFolder, zipFilePath) {
    return new Promise((resolve, reject) => {
        const targetBasePath = path.dirname(zipFilePath);

        if (targetBasePath === srcFolder) {
            return reject(Error("Source and target folder must be different."));
        }

        fs.accessSync(srcFolder, fs.constants.F_OK);
        // try {
        fs.accessSync(path.dirname(zipFilePath), fs.constants.F_OK);
        // } catch (err) {
        //     console.log("yahi mc hai");
        // }
        const output = fs.createWriteStream(zipFilePath);
        const zipArchive = archiver("zip");

        output.on("close", function () {
            resolve();
        });

        // Error while compressing the folder and writing to directory
        zipArchive.on("error", function (err) {
            return reject(err);
        });

        zipArchive.pipe(output);
        zipArchive.directory(srcFolder, false);
        zipArchive.finalize();
    });
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

/**
 * Generate Access token for authentication user operations
 * @param {User} usr
 * @returns String
 */
function generateAccessToken(usr) {
    return jwt.sign(
        {
            name: usr.name,
            email: usr.email,
            path: usr.path,
            admin: usr.admin,
        },
        config.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: config.ACCESS_TOKEN_EXPIRY } // Token expiry
    );
}

/**
 * Generate rotating refresh token for providing access tokens
 * @param {User} usr
 * @param {String} device_id
 * @returns String - JWT Token
 */
function generateRefreshToken(usr, device_id) {
    return jwt.sign(
        {
            email: usr.email,
            device_id: device_id,
        },
        config.REFRESH_TOKEN_SECRET_KEY,
        { expiresIn: config.REFRESH_TOKEN_EXPIRY } // Token expiry
    );
}

module.exports = {
    checkAuthentication: checkAuthentication,
    checkAuthorization: checkAuthorization,
    verifyPassword: verifyPassword,
    getFolderSize: getFolderSize,
    validateEmail: validateEmail,
    checkFilePath: checkFilePath,
    zipFolder: zipFolder,
    generateAccessToken: generateAccessToken,
    generateRefreshToken: generateRefreshToken,
    getFileExtension: getFileExtension,
};
