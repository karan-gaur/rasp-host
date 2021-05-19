const fs = require("fs");
const uuid = require("uuid");
const path = require("path");
const bcrypt = require("bcrypt");
const express = require("express");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const config = require("../config");
const utility = require("../utility");
const constants = require("../constants");

const router = express.Router();
const logger = constants.LOGGER;
const transport = nodemailer.createTransport(config.mailer);

// Login
router.post("/login", async (req, res) => {
    // Validating Params
    if (typeof req.body.email !== "string" || typeof req.body.password !== "string") {
        logger.info(`Missing body params Username/Password`);
        return res.status(400).json({ error: "Invalid/Missing required values - username/password [String]." });
    }
    try {
        const usr = await User.findOne({ email: req.body.email }).exec();
        if (usr) {
            // User Exists
            bcrypt.compare(req.body.password, usr.hash).then((resolve) => {
                if (!resolve) {
                    // Invalid Password
                    logger.info(`Invalid Password for - '${req.body.email}'`);
                    return res.status(401).json({ error: "Invalid username/password. Please re-login" });
                } else {
                    // Login Successful
                    logger.info(`Login Successful for user - '${req.body.email}'`);

                    if (fs.existsSync(usr.path.join(path.sep)) && fs.lstatSync(usr.path.join(path.sep)).isFile()) {
                        // User directory has been deleted & cannot be created since file with similar name exists.
                        logger.warn(
                            `User directory can't be recreated. File with similar name exists  - '${usr.path.join(
                                path.sep
                            )}`
                        );
                        return res.status(500).json({ error: "Delete file with similar name as user's email" });
                    } else if (!fs.existsSync(usr.path.join(path.sep))) {
                        // User directory does not exists
                        logger.warn(`User directory has been moved or deleted - '${usr.path.join(path.sep)}'`);
                        fs.mkdirSync(usr.path.join(path.sep));
                        logger.info(`Recreated user directory '${usr.path.join(path.sep)}`);
                    }

                    const token = utility.generateAccessToken(usr);
                    let device_id = req.body.device_id ? req.body.device_id : uuid.v4();
                    let refreshToken = utility.generateRefreshToken(usr, device_id);
                    usr.devices.set(device_id, refreshToken);
                    usr.save((saveError) => {
                        if (saveError) {
                            logger.error(`Error adding new device for '${usr.email}. Err - ${saveError}`);
                            return res.sendStatus(500);
                        }
                        logger.info(`New device added for user - ${usr.email}`);
                    });

                    return res.json({
                        token: token,
                        refreshToken: refreshToken,
                        device_id: device_id,
                        path: [],
                        name: usr.name,
                        admin: usr.admin,
                    });
                }
            });
        } else {
            // No such user
            logger.info(`No user with username - '${req.body.email}'`);
            return res.status(404).json({ error: "Invalid username/password. Please re-login" });
        }
    } catch (err) {
        logger.error(`Error logging in user - '${req.body.email}'. Error - ${err}`);
        return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
    }
});

// Register new Account.
router.post(
    "/register",
    [utility.checkAuthentication, utility.checkAuthorization, utility.verifyPassword],
    async (req, res) => {
        // Validating Body params
        if (typeof req.body.name !== "string" || req.body.name.length == 0 || req.body.name.length > 32) {
            logger.error(`Invalid '/register' body param - {'name':'${req.body.name}'}`);
            return res
                .status(400)
                .json({ error: "Invalid value for 'name' - '" + req.body.name + "'. Must be string [1-32 Chars]." });
        } else if (typeof req.body.email !== "string" || !utility.validateEmail(req.body.email)) {
            logger.error(`Invalid '/register' body param - {'email':'${req.body.email}'}`);
            return res
                .status(400)
                .json({ error: "Invalid value for 'email' - '" + req.body.email + "'. Must be string [1-256 Chars]." });
        } else if (
            typeof req.body.user_pass !== "string" ||
            req.body.user_pass.length < 6 ||
            req.body.user_pass.length > 32
        ) {
            logger.error(`Invalid '/register' body param - {'user_pass':'${req.body.user_pass}'}`);
            return res.status(400).json({
                error: "Invalid value for 'user_pass' - '" + req.body.user_pass + "'. Must be string [6-32 Chars].",
            });
        } else if (typeof req.body.admin !== "undefined" && typeof req.body.admin !== "boolean") {
            logger.error(`Invalid '/register' body param - {'admin':'${req.body.admin}'}`);
            return res
                .status(400)
                .json({ error: "Invalid value for 'admin' - '" + req.body.admin + "'. Must be Boolean [true/false]." });
        } else if (typeof req.body.storageLimit !== "number" || req.body.storageLimit <= 0) {
            logger.error(`Invalid '/register' body param - {'storageLimit':'${req.body.storageLimit}'}`);
            return res.status(400).json({
                error: "Invalid value for 'storageLimit' - '" + req.body.storageLimit + "'. Must be +ve Number.",
            });
        }

        // Login Successful - Creating new Account.
        var new_user = new User();
        new_user.name = req.body.name;
        new_user.email = req.body.email;
        new_user.admin = req.body.admin ? true : false;
        new_user.path = path.dirname(__dirname).split(path.sep);
        new_user.path.push("users", req.body.email);
        new_user.devices = {};
        new_user.storageLimit = req.body.storageLimit
            ? req.body.storageLimit * 1024 * 1024 * 1024
            : config.USER_STORAGE_LIMIT;

        try {
            if (
                fs.existsSync(new_user.path.join(path.sep)) &&
                fs.lstatSync(new_user.path.join(path.sep)).isDirectory()
            ) {
                // User directory already exists. Evaluating folder size
                try {
                    logger.info(`User directory already exists - '${new_user.path.join(path.sep)}`);
                    new_user.storage = utility.getFolderSize(new_user.path.join(path.sep));
                    logger.info(`Evaluated folder size - '${new_user.storage}`);
                } catch (err) {
                    logger.error(`Error evaluating folder size - '${new_user.path.join(path.sep)}'. Error - ${err}`);
                    return res.status(500).json({
                        error: "Internal server error. Contact System Administrator",
                    });
                }
            } else if (
                fs.existsSync(new_user.path.join(path.sep)) &&
                fs.lstatSync(new_user.path.join(path.sep)).isFile()
            ) {
                logger.error(`Cannot create directory - '${new_user.path.join(path.sep)}' - as file already exists`);
                return res.status(422).json({ error: "Cannot create user with username - " + req.body.email });
            } else {
                // Creating user directory
                fs.mkdirSync(new_user.path.join(path.sep));
                logger.info(`User directory created - '${new_user.path.join(path.sep)}'`);
            }

            // Encryting password and saving in the Database
            new_user.hash = await bcrypt.hash(req.body.user_pass, config.SALT);
            new_user.save((saveError) => {
                if (saveError && saveError.code === 11000) {
                    logger.info(`Duplicate key found - '${new_user.email}`);
                    return res.status(409).json({
                        error: "Duplicate 'email' parameter. User already exists",
                    });
                } else if (saveError) {
                    logger.error(`Error saving new user - '${new_user.email}. Err - ${saveError}`);
                    return res.status(500).json({
                        error: "Internal server error. Contact System Administrator",
                    });
                }
                return res.sendStatus(200);
            });
        } catch (err) {
            logger.error(`Error registering user from admin - '${req.body.token.email}'. Error - ${err}`);
            return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
        }
    }
);

// Refresh Token API
router.post("/getAccessToken", async (req, res) => {
    if (typeof req.body.refreshToken === "undefined") {
        logger.info(`Missing required field 'refreshToken' in body`);
        return res.status(400).json({ error: "Missing field 'refreshToken' in body" });
    }
    try {
        let refreshToken = jwt.verify(req.body.refreshToken, config.REFRESH_TOKEN_SECRET_KEY);
        let device_id = refreshToken.device_id;

        const usr = await User.findOne({ email: refreshToken.email }).exec();
        if (usr) {
            let accessToken = utility.generateAccessToken(usr);
            refreshToken = utility.generateRefreshToken(usr, device_id);

            usr.devices.set(device_id, refreshToken);
            usr.save(function (saveError) {
                if (saveError) {
                    logger.error(`Error updating refreshtoken for '${usr.email}. Err - ${saveError}`);
                    return res.sendStatus(500);
                }
                logger.info(`New refresh token generated for - ${usr.email}`);
            });
            return res.json({
                accessToken: accessToken,
                refreshToken: refreshToken,
            });
        } else {
            // No such user
            logger.info(`No user with username - '${refreshToken.email}'`);
            return res.status(404).json({ error: "Invalid username/password. Please re-login" });
        }
    } catch (err) {
        logger.error(`Error generating accessToken for user - '${refreshToken.email}'. Error - ${err}`);
        return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
    }
});

// Delete self User
router.post("/self/delete", [utility.checkAuthentication, utility.verifyPassword], async (req, res) => {
    try {
        if (typeof req.body.delData !== "boolean") {
            // Invalid arguement parsed - req.body.delData
            logger.error(`Invalid/Missing value for body param - { delData: ${req.body.delData} }. Must be Boolean.`);
            return res
                .status(422)
                .json({ error: "Invalid/Missing value for delData - '" + req.body.delData + "'. Required - BOOLEAN" });
        }
        if (req.body.delData) {
            // Deleting user directory
            fs.rmSync(req.body.token.path.join(path.sep), { recursive: true });
            logger.info(`User root directory deleted - '${req.body.token.path.join(path.sep)}'`);
        }

        // Deleting user from DB
        await User.deleteOne({ email: req.body.token.email });
        logger.info(`User deleted from DB - '${req.body.token.email}`);
        return res.sendStatus(200);
    } catch (err) {
        logger.error(`Error deleting user - '${req.body.token.email}'. Error - ${err}`);
        return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
    }
});

// Delete User
router.post(
    "/admin/delete",
    [utility.checkAuthentication, utility.checkAuthorization, utility.verifyPassword],
    async (req, res) => {
        try {
            // Validating Body Params
            if (typeof req.body.email !== "string") {
                logger.error(`Invalid body attribute 'email' for '/admin/delete'. User - '${req.body.email}'`);
                return res.status(400).json({ error: "Invalid value for 'email' - " + req.body.email });
            } else if (typeof req.body.delData !== "boolean") {
                // Invalid arguement parsed - req.body.delData
                logger.error(
                    `Invalid body attribute 'delData' for '/admin/delete' - '${req.body.delData}'. Must be Boolean.`
                );
                return res
                    .status(422)
                    .json({ error: "Invalid value for 'delData' - '" + req.body.delData + "'. Required - BOOLEAN" });
            }

            // Deleting user
            const usr = await User.findOne({ email: req.body.email });
            if (usr) {
                if (req.body.delData) {
                    // Deleting user directory
                    fs.rmSync(usr.path.join(path.sep), { recursive: true });
                    logger.info(`User root directory deleted - '${req.body.token.path.join(path.sep)}'`);
                }

                // Deleting user from DB
                usr.remove();
                return res.sendStatus(200);
            } else {
                // No such user
                logger.info(`No user with username - '${req.body.email}'`);
                return res.status(404).json({ error: "Invalid email. No such user exists" });
            }
        } catch (err) {
            logger.error(`Error deleting user - '${req.body.token.email}'. Error - ${err}`);
            return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
        }
    }
);

// Create admin user.
router.post("/create_dummy", (req, res) => {
    // Creating dummy user for testing
    var new_user = new User();
    new_user.name = req.body.name;
    new_user.email = req.body.email;
    new_user.admin = req.body.admin;
    new_user.path = path.dirname(__dirname).split(path.sep);
    new_user.path.push("users", req.body.email);
    new_user.storageLimit = req.body.storageLimit
        ? req.body.storageLimit * 1024 * 1024 * 1024
        : config.USER_STORAGE_LIMIT;

    bcrypt.hash(req.body.password, 10).then((hashPwd) => {
        if (err) {
            logger.error(`Error encrypting password for '${new_user.email}. Err - '${err}'`);
            return res.sendStatus(500);
        } else {
            new_user.hash = hashPwd;
            new_user.save(function (saveError) {
                if (saveError) {
                    logger.info(`Error encrypting password for '${new_user.email}. Err - ${saveError}`);
                    res.sendStatus(500);
                } else {
                    fs.mkdirSync(new_user.path.join(path.sep));
                    res.sendStatus(200);
                    console.log("user added");
                }
            });
        }
    });
});

module.exports = router;
