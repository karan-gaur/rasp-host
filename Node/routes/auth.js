const fs = require("fs");
const uuid = require("uuid");
const path = require("path");
const bcrypt = require("bcrypt");
const express = require("express");
const jwt = require("jsonwebtoken");

const config = require("../config");
const constants = require("../constants");
const utility = require("../utilities/utility");
const futility = require("../utilities/fileUtility");
const check = require("../utilities/validationUtility");

const router = express.Router();
const logger = constants.LOGGER;

// Login
router.post("/login", [check.verifyEmail, check.verifyPassword], async (req, res) => {
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
                        fs.mkdirSync(usr.path.join(path.sep));
                        logger.warn(`User directory missing. Recreated directory - '${usr.path.join(path.sep)}'`);
                    }

                    const token = utility.generateAccessToken(usr);
                    let device_id = req.body.device_id ? req.body.device_id : uuid.v4();
                    let refreshToken = utility.generateRefreshToken(usr, device_id);

                    // Managing user device limit
                    if (usr.devices.size >= config.USER_DEVICE_LIMIT && !usr.devices.has(device_id)) {
                        usr.devices.delete(utility.get_LRU_Device(usr.devices));
                    }

                    usr.devices.set(device_id, { refreshToken: refreshToken });
                    usr.save((saveError) => {
                        if (saveError) {
                            logger.error(`Error adding new device for '${usr.email}. Err - ${saveError}`);
                            return res.sendStatus(500);
                        }
                        logger.info(`Updated user device list for - ${usr.email}`);
                    });
                    console.log();
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

// Logout user from all devices
router.post("/logout/all", [utility.checkAuthentication, utility.verifyPassword], async (req, res) => {
    try {
        const usr = await User.findOne({ email: req.body.token.email }).exec();
        usr.devices = {};
        usr.save((saveError) => {
            if (saveError) {
                logger.error(`Error deleting user devices for - ${req.body.token.email}`);
                return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
            }
            logger.info(`Deleted all devices for user - ${req.body.token.email}`);
            return res.sendStatus(200);
        });
    } catch (err) {
        logger.error(`Error verifying user password - '${req.body.token.email}' - Err - ${err}`);
        return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
    }
});

// Register new Account.
router.post(
    "/register",
    [
        utility.checkAuthentication,
        utility.checkAuthorization,
        utility.verifyPassword,
        check.validateName,
        check.validateEmail,
        check.validateUserPass,
        check.validateAdminAccess,
    ],
    async (req, res) => {
        // Login Successful - Creating new Account.
        var new_user = new User();
        new_user.name = req.body.name;
        new_user.email = req.body.email;
        new_user.path = path.dirname(__dirname).split(path.sep);
        new_user.path.push("users", req.body.email);
        new_user.admin = req.body.admin ? req.body.admin : false;
        new_user.storageLimit = isNaN(req.body.storageLimit)
            ? config.USER_STORAGE_LIMIT
            : req.body.storageLimit * 1024 * 1024 * 1024;

        try {
            if (
                fs.existsSync(new_user.path.join(path.sep)) &&
                fs.lstatSync(new_user.path.join(path.sep)).isDirectory()
            ) {
                // User directory already exists. Evaluating folder size
                try {
                    new_user.storage = futility.getFolderSize(new_user.path.join(path.sep));
                    logger.info(`User directory exists. User '${new_user.email}'s folder size - '${new_user.storage}`);
                } catch (err) {
                    logger.error(`Error evaluating folder size - '${new_user.path.join(path.sep)}'. Error - ${err}`);
                    return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
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
            new_user.hash = await bcrypt.hash(req.body.userPass, config.SALT);
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
router.post("/getAccessToken", check.validateRToken, async (req, res) => {
    try {
        let refreshToken = jwt.verify(req.body.refreshToken, config.REFRESH_TOKEN_SECRET_KEY);
        let device_id = refreshToken.device_id;

        const usr = await User.findOne({ email: refreshToken.email }).exec();
        if (usr) {
            // Verifying refresh token
            if (req.body.refreshToken !== usr.devices.get(device_id).refreshToken) {
                // Token might be compromised. Removing device from user_devices
                logger.warn(`Refresh Token might be compromised for - ${usr.email}`);
                usr.devices.delete(device_id);
                res.status(403).json({ error: "Refresh token has expired" });
            } else {
                // Updating refresh token for device
                let accessToken = utility.generateAccessToken(usr);
                refreshToken = utility.generateRefreshToken(usr, device_id);
                usr.devices.set(device_id, { refreshToken: refreshToken });
                res.status(200).json({ token: accessToken, refreshToken: refreshToken });
                logger.info(`New refresh token generated for - ${usr.email}`);
            }
            usr.save(function (saveError) {
                if (saveError) {
                    logger.error(`Error updating refreshtoken for '${usr.email}. Err - ${saveError}`);
                    return res.sendStatus(500);
                }
            });
        } else {
            // No such user
            logger.info(`No user with username - '${refreshToken.email}'`);
            return res.status(403).json({ error: "Invalid token. Please re-login" });
        }
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError || err instanceof jwt.JsonWebTokenError) {
            logger.error(`Error validating JWT from request. Err - ${err}`);
            return res.status(401).json({ error: "JWT Token unauthorised - reissue required." });
        }
        logger.error(`Error generating accessToken - Error - ${err}`);
        return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
    }
});

// Delete self User
router.post(
    "/self/delete",
    [utility.checkAuthentication, utility.verifyPassword, check.validateDelData],
    async (req, res) => {
        try {
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
    }
);

// Delete User
router.post(
    "/admin/delete",
    [
        utility.checkAuthentication,
        utility.checkAuthorization,
        utility.verifyPassword,
        check.validateEmail,
        check.validateDelData,
    ],
    async (req, res) => {
        try {
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
router.get("/reset/admin", async (req, res) => {
    const usr = await User.findOne({ email: config.ADMIN_EMAIL }).exec();

    var new_user = new User();
    new_user.name = config.ADMIN_NAME;
    new_user.email = config.ADMIN_EMAIL;
    new_user.admin = true;
    new_user.path = path.dirname(__dirname).split(path.sep);
    new_user.path.push("users", config.ADMIN_EMAIL);
    new_user.storage = usr ? usr.storage : 0;
    new_user.storageLimit = usr ? usr.storageLimit : config.USER_STORAGE_LIMIT;

    // Deleting previous admin user
    await User.deleteOne({ email: config.ADMIN_EMAIL });

    bcrypt
        .hash(config.ADMIN_PASS, config.SALT)
        .then((hashPwd) => {
            new_user.hash = hashPwd;
            new_user.save(function (saveError) {
                if (saveError) {
                    logger.error(`Error saving encrypting password for '${new_user.email}. Err - ${saveError}`);
                    return res.sendStatus(500);
                } else if (!fs.existsSync(new_user.path.join(path.sep))) {
                    // Create new directory if does not exists
                    fs.mkdirSync(new_user.path.join(path.sep));
                }
                logger.info(`Successfully resetted admin user`);
                return res.sendStatus(200);
            });
        })
        .catch((err) => {
            logger.error(`Error encrypting password for '${new_user.email}. Err - '${err}'`);
            return res.sendStatus(500);
        });
});

module.exports = router;
