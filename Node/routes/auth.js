const fs = require("fs");
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
router.post("/login", (req, res) => {
    User.findOne({ email: req.body.email }, async (err, user) => {
        if (err) {
            // Error fetching from DB
            logger.error(`Error fetching user details from DB - ${err}`);
            return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
        } else if (user) {
            // User Exists
            await bcrypt.compare(req.body.password, user.getHash()).then((resolve) => {
                if (!resolve) {
                    // Invalid Password
                    logger.info(`Invalid Password for - '${req.body.email}'`);
                    return res.status(401).json({ error: "Invalid username/password. Please re-login" });
                } else {
                    // Login Successful
                    logger.info(`Login Successful for user - '${req.body.email}'`);
                    const token = jwt.sign(
                        {
                            name: user.name,
                            email: user.email,
                            path: user.path,
                            admin: user.admin,
                        },
                        config.SECRET_KEY,
                        {
                            expiresIn: config.TOKEN_EXPIRY, // Token expiry
                        }
                    );

                    // Creating user directory if deleted
                    if (
                        !(fs.existsSync(user.path.join(path.sep)) && fs.lstatSync(user.path.join(path.sep)).isDirectory)
                    ) {
                        logger.warn(`User directory has been moved or deleted - '${user.path.join(path.sep)}'`);
                        fs.mkdirSync(user.path.join(path.sep));
                        logger.info(`Recreated user directory '${user.path.join(path.sep)}`);
                    }
                    return res.json({
                        token: token,
                        path: [],
                        name: user.name,
                        admin: user.admin,
                    });
                }
            });
        } else {
            // No such user
            logger.info(`No user with username - '${req.body.email}'`);
            return res.status(404).json({ error: "Invalid username/password. Please re-login" });
        }
    });
});

// Register new Account.
router.post("/register", (req, res) => {
    // Verifiying if user has Admin Privileges
    User.findOne({ email: req.body.email }, async (err, user) => {
        if (err) {
            // Error fetching from DB
            logger.error(`Error fetching user details from DB - ${err}`);
            return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
        } else if (user) {
            // User Exists
            await bcrypt.compare(req.body.password, user.getHash()).then((resolve) => {
                if (!resolve) {
                    // Invalid Password
                    logger.info(`Invalid Password for - '${req.body.email}'`);
                    return res.status(401).json({ error: "Invalid username/password. Please re-login" });
                } else {
                    if (!user.admin) {
                        // User has insufficient privileges to create a new user.
                        logger.warn(`'${user.email}' does not have permission to create a new user`);
                        return res.status(401).json({
                            error: "User does not have permission to create a new user",
                        });
                    }

                    // Login Successful - Creating new Account.
                    var new_user = new User();
                    new_user.name = req.body.new_name;
                    new_user.email = req.body.new_email;
                    new_user.admin = req.body.admin ? true : false;
                    new_user.path = path.dirname(__dirname).split(path.sep);
                    new_user.path.push("users", req.body.new_email);
                    new_user.storageLimit = req.body.storageLimit
                        ? req.body.storageLimit * 1024 * 1024 * 1024
                        : config.USER_STORAGE_LIMIT;

                    if (
                        fs.existsSync(new_user.path.join(path.sep)) &&
                        fs.lstatSync(new_user.path.join(path.sep)).isDirectory()
                    ) {
                        // User directory already exists. Evaluating folder size
                        try {
                            logger.info(`User directory already exists - '${new_user.path.join(path.sep)}`);
                            new_user.storage = utility.getFolderSize(new_user.path.join(path.sep));
                            logger.info(`Evaluated folder size - '${new_user.storage}`);
                        } catch (e) {
                            logger.error(e);
                            return res.status(500).json({
                                error: "Internal server error. Contact System Administrator",
                            });
                        }
                    } else {
                        // Creating user directory
                        fs.mkdirSync(new_user.path.join(path.sep));
                    }

                    // Encryting password and saving in the Database
                    bcrypt.hash(req.body.new_password, 10).then(function (hashPwd) {
                        new_user.setHash(hashPwd);
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
                    });
                }
            });
        } else {
            // No such user
            logger.info(`No user with username - '${req.body.email}'`);
            return res.status(404).json({ error: "Invalid username/password. Please re-login" });
        }
    });
});

// GET Contact Us page.
router.post("/contact", (req, res) => {
    // Mailing client details
    const mailoptions = {
        from: req.body.email,
        to: "national.creche@gmail.com",
        subject: `You got a new mail from visitor - '${req.body.name}'`,
        text: req.body.message,
    };
    transport.sendMail(mailoptions, function (err, success) {
        if (err) {
            // Error sending mail
            logger.error(`Error sending mail - ${err}`);
            return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
        } else {
            // Mail Sent
            logger.info(`Received mail from - '${req.body.email}'`);
            return res.sendStatus(200);
        }
    });
});

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

    bcrypt.hash(req.body.password, 10, (err, hashPwd) => {
        if (err) {
            logger.error(`Error encrypting password for '${new_user.email}. Err - '${err}'`);
            return res.sendStatus(500);
        } else {
            new_user.setHash(hashPwd);
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
