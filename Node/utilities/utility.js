const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config");
const constants = require("../constants");
const logger = constants.LOGGER;

/**
 * User API authentication check. Works as a middleware.
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
        return res.status(400).json({ error: `Invalid value 'password' - '${req.body.password}' [Exp - String].` });
    }

    try {
        // Verifying user password
        const usr = await User.findOne({ email: req.body.token.email }).exec();
        if (usr) {
            // User Exists
            await bcrypt.compare(req.body.password, usr.hash).then((resolve) => {
                if (!resolve) {
                    // Invalid Password
                    logger.warn(`Invalid Password for - '${req.body.token.email}'`);
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

/**
 * Fetch Least-Recently-Used device by index from given list of devices.
 * @param {Object} devices
 * @returns {Number} Index of LRU device
 */
function get_LRU_Device(devices) {
    let oldest_value = undefined;
    let oldest_value_index = undefined;
    devices.forEach((value, key) => {
        // Finding Least Recently Used Value
        if (typeof oldest_value === "undefined" || oldest_value > value.lastUsed) {
            oldest_value = value.lastUsed;
            oldest_value_index = key;
        }
    });
    return oldest_value_index;
}

module.exports = {
    checkAuthentication: checkAuthentication,
    checkAuthorization: checkAuthorization,
    verifyPassword: verifyPassword,
    generateAccessToken: generateAccessToken,
    generateRefreshToken: generateRefreshToken,
    get_LRU_Device: get_LRU_Device,
};
