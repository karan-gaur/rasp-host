const fs = require("fs");
const util = require("util");
const path = require("path");
const config = require("../config");
const constants = require("../constants");

const logger = constants.LOGGER;
const access = util.promisify(fs.access);

// Verify if essential parameters are passed in request.

/**
 * Check if 'email' is passed in req.body object. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function verifyEmail(req, res, next) {
    if (typeof req.body.email !== "string") {
        logger.info(`Missing body param - { 'email': '${req.body.email}' }`);
        return res
            .status(400)
            .json({ error: `Invalid value 'email' - '${req.body.email}' [Exp - Email addr@domain].` });
    }
    next();
}

/**
 * Check if 'password' is passed in req.body object. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function verifyPassword(req, res, next) {
    if (typeof req.body.password !== "string") {
        logger.info(`Missing body param - { 'password': '${req.body.password}' }`);
        return res.status(400).json({ error: `Invalid value 'password' - '${req.body.password}' [Exp - String].` });
    }
    next();
}

/**
 * Check if 'storageLimit' is passed in req.body object. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function verifyStorageLimit(req, res, next) {
    if (req.body.storageLimit && (typeof req.body.storageLimit !== "number" || req.body.storageLimit <= 0)) {
        logger.info(`Invalid body param - { 'storageLimit': '${req.body.storageLimit}' }`);
        return res.status(400).json({
            error: `Invalid value 'storageLimit' - '${req.body.storageLimit}' [Exp - Integer 0-∞]`,
        });
    }
    next();
}

// Validate if parameters passed in request are valid.

/**
 * Validates if 'email' in req.body is a valid email. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function validateEmail(req, res, next) {
    const re =
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    if (
        typeof req.body.email === "undefined" ||
        req.body.email.length < 6 ||
        req.body.email.length > 256 ||
        !re.test(String(req.body.email).toLowerCase())
    ) {
        logger.info(`Invalod body param 'email'- { 'email': '${req.body.email}' }`);
        return res
            .status(400)
            .json({ error: `Invalid value 'email' - '${req.body.email}' [Exp - Email addr@domain].` });
    }
    next();
}

/**
 * Validates if 'name' in req.body is a valid name. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function validateName(req, res, next) {
    if (typeof req.body.name !== "string" || req.body.name.length == 0 || req.body.name.length > 32) {
        logger.info(`Invalid body param - { 'name': '${req.body.name}' }`);
        return res.status(400).json({ error: `Invalid value 'name' - '${req.body.name}' [Exp - String 1-32 Chars].` });
    }
    next();
}

/**
 * Validates if 'refreshToken' value is passed and is a string. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function validateRToken(req, res, next) {
    if (typeof req.body.refreshToken !== "string") {
        logger.info(`Invalid body param - { 'refreshToken': '${req.body.refreshToken}' }`);
        return res.status(400).json({ error: `Invalid value 'refreshToken' - '${req.body.refreshToken}'` });
    }
    next();
}

/**
 * Validates if 'delData' in req.body is Boolean. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function validateDelData(req, res, next) {
    if (typeof req.body.delData !== "boolean") {
        logger.info(`Invalid body param - { 'delData': '${req.body.delData}' }`);
        return res.status(422).json({ error: `Invalid value 'delData' - '${req.body.delData}' [Exp - Boolean]` });
    }
    next();
}

/**
 * Validates if 'userPass' in req.body is a valid password. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function validateUserPass(req, res, next) {
    if (typeof req.body.userPass !== "string" || req.body.userPass.length < 6 || req.body.userPass.length > 32) {
        logger.info(`Invalid body param - { 'userPass': '${req.body.userPass}' }`);
        return res.status(400).json({
            error: `Invalid value 'userPass' - '${req.body.userPass}' [Exp - String 6-32 Chars]`,
        });
    }
    next();
}

/**
 * Validates if 'admin' in req.body is Boolean. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function validateAdminAccess(req, res, next) {
    if (typeof req.body.admin !== "undefined" && typeof req.body.admin !== "boolean") {
        logger.info(`Invalid body param - { 'admin': '${req.body.admin}' }`);
        return res.status(400).json({ error: `Invalid value 'admin' - '${req.body.admin}' [Exp - Boolean]` });
    }
    next();
}

/**
 * Validates if 'storageLimit' in req.body is a +ve Integer. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function validateStorageLimit(req, res, next) {
    if (typeof req.body.storageLimit !== "number" || req.body.storageLimit <= 0) {
        logger.info(`Invalid body param - { 'storageLimit': '${req.body.storageLimit}' }`);
        return res.status(400).json({
            error: `Invalid value 'storageLimit' - '${req.body.storageLimit}' [Exp - Integer 0-N]`,
        });
    }
    next();
}

/**
 * Validates if 'message' value in req.body is a non-empty string. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function validateContactMessage(req, res, next) {
    if (
        typeof req.body.message !== "string" ||
        req.body.message.length == 0 ||
        req.body.message.length >= config.MAX_EMAIL_BODY_LENGTH
    ) {
        logger.info(`Invalid body param - { 'message': '${req.body.message}' }`);
        return res
            .status(400)
            .json({ error: `Invalid value 'message' - '${req.body.message}' [Exp - Non-empty String].` });
    }
    next();
}

/**
 * Validates if 'limit' & 'page' values in req.query are +ve Integers. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function validatePaginationParams(req, res, next) {
    const page = req.query.page;
    const limit = req.query.limit;

    if (isNaN(limit) || isNaN(page)) {
        logger.info(
            `Query values are not a Number - { 'page': ${page}, 'limit': ${limit}, 'email': '${req.body.token.email}' }`
        );
        return res.status(400).json({
            error: `Invalid query params - { 'limit': '${limit}' (Number), 'page': '${page}' (Number) }`,
        });
    }
    next();
}

// File Storage Validations

/**
 * Check if 'isFolder' in req.body object is Boolean. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function verifyIsFolder(req, res, next) {
    if (typeof req.body.isFolder !== "boolean") {
        logger.error(`Invalid body param - { 'isFolder': '${req.body.isFolder}' }`);
        return res.status(400).json({ error: `Invalid value 'isFolder' - '${req.body.isFolder}' [Exp - true/false].` });
    }
    next();
}

/**
 * Check if 'fName' is passed in req.body object. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function verifyFileName(req, res, next) {
    if (typeof req.body.fName !== "string" || req.body.fName.length == 0) {
        logger.error(`Invalid body param - { 'fName': '${req.body.fName}' }`);
        return res
            .status(400)
            .json({ error: `Invalid body value 'fName' - '${req.body.fName}' [Exp - Non-empty String].` });
    }
    next();
}

/**
 * Check if 'uploadedFile' is passed in req.files object. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function verifyUploadedFile(req, res, next) {
    if (!req.files || !req.files.uploadedFile) {
        logger.info(`Missing body param - 'uploadedFile`);
        return res.status(400).json({ error: `Invalid/Missing required value - 'uploadedFile' [Exp - File].` });
    }
    next();
}

/**
 * Check if given file exists for user. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
async function checkFilePath(req, res, next) {
    try {
        if (typeof req.body.path !== "undefined" && Array.isArray(req.body.path)) {
            if (req.body.path.includes("..")) {
                logger.warn(`Found '..' usage in directory path - '${req.body.path}`);
                return res.status(400).json({ error: "Illegal 'path' value. Usage of '..' is not allowed" });
            }
            req.body.filePath = path.join(req.body.token.path.join(path.sep), req.body.path.join(path.sep));
        } else {
            logger.info(`Invalid body param 'path' - { 'path': '${req.body.path}' }`);
            return res.status(400).json({ error: `Missing body param 'path' - '${req.body.path}' [Exp Array Object]` });
        }
        await access(req.body.filePath);
        next();
    } catch (err) {
        logger.info(`No such file/folder exists - ${req.body.path}. Error - ${err}`);
        return res.status(400).json({ error: `No such file/folder exists - '${req.body.path.join(path.sep)}'` });
    }
}

/**
 * Checks if any operation performed on user's root directory. Works as a middleware.
 * @param {ReqBody} req User API request object
 * @param {ResBody} res User API response object
 * @param {*} next Callback
 */
function rootDirChanges(req, res, next) {
    if (req.body.path.length == 0) {
        logger.warn(`Root directory operation detected - '${req.body.filePath}'`);
        return res.status(403).json({
            error: `Cannot perform operation on user's root directory - '${req.body.path.join(path.sep)}'`,
        });
    }
    next();
}

module.exports = {
    // Verify request body
    verifyEmail: verifyEmail,
    verifyPassword: verifyPassword,
    verifyStorageLimit: verifyStorageLimit,

    // Validate request body
    validateName: validateName,
    validateEmail: validateEmail,
    validateRToken: validateRToken,
    validateDelData: validateDelData,
    validateUserPass: validateUserPass,
    validateAdminAccess: validateAdminAccess,
    validateStorageLimit: validateStorageLimit,
    validateContactMessage: validateContactMessage,
    validatePaginationParams: validatePaginationParams,

    // File validators
    verifyIsFolder: verifyIsFolder,
    verifyFileName: verifyFileName,
    verifyUploadedFile: verifyUploadedFile,
    checkFilePath: checkFilePath,
    rootDirChanges: rootDirChanges,
};
