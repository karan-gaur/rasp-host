const express = require("express");

const config = require("../config");
const utility = require("../utility");
const constants = require("../constants");
const { USER_STORAGE_LIMIT } = require("../config");

const router = express.Router();
const logger = constants.LOGGER;

// Update user storage limit
router.post("/storageLimit", [utility.checkAuthentication, utility.checkAuthorization], (req, res) => {
    // Validating Body Params
    if (typeof req.body.email !== "string") {
        logger.error(`Invalid body attribute 'email' for '/storageLimit'. User - '${req.body.email}'`);
        return res.status(400).json({ error: "Invalid value for 'email' - " + req.body.email });
    } else if (typeof req.body.storageLimit !== "number" || req.body.storageLimit == 0) {
        logger.error(`Invalid body attribute 'storageLimit' for '/storageLimit' - '${req.body.storageLimit}'`);
        return res.status(400).json({ error: "Invalid value for 'storageLimit' - " + req.body.storageLimit });
    }

    User.findOne({ email: req.body.email })
        .then((usr) => {
            if (usr) {
                // User exists - updating user storage limit
                logger.info(`Updating (${usr.email}) storage limit ${usr.storageLimit}=>${req.body.storageLimit}`);
                usr.storageLimit = req.body.storageLimit;
                usr.save((saveError) => {
                    if (saveError) {
                        logger.info(`Error saving updated storage limit for '${usr.email}. Err - ${saveError}`);
                        return res.status(500).json({
                            error: "Internal server error. Contact System Administrator",
                        });
                    }
                    return res.sendStatus(200);
                });
                return res.status(200);
            } else {
                // User does not exists
                loggger.error(`No such user - '${req.body.token.email}`);
                return res.status(404).json({
                    error: "Invalid username/password. Please re-login",
                });
            }
        })
        .catch((err) => {
            logger.error(`Error updating storageLimit for user - '${req.body.token.email}'. Error - ${err}`);
            return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
        });
});

// Get user's list using pagination for lazy loading
router.get("/getUsers", [utility.checkAuthentication, utility.checkAuthorization], (req, res) => {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);

    // Validating query params
    if (isNaN(limit) || isNaN(page)) {
        logger.error(
            `Query values are not a Number for endpoint - '/getUsers' - {'page':${page}, ` +
                `'limit':${limit}, 'email':'${req.body.token.email}'}`
        );
        return res.status(400).json({ error: "Invalid query params - Required - {'limit':Number, 'page':Number}" });
    }

    User.find({}, { _id: 0, __v: 0, path: 0, hash: 0 })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ name: "asc" })
        .exec((err, users) => {
            if (err) {
                logger.error(
                    `Error fetching paginated values {'page':${page}, 'limit':${limit}, 'email':` +
                        `'${req.body.token.email}'}. Error - ${err}`
                );
                return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
            }
            return res.status(200).json({ users: users });
        });
});

// GET Contact Us page.
router.post("/contact", (req, res) => {
    // Validating body params
    if (typeof req.body.name !== "string" || req.body.name.length == 0 || req.body.name.length > 32) {
        logger.error(`Invalid '/register' body param - {'name':'${req.body.name}'}`);
        return res
            .status(400)
            .json({ error: "Invalid value for 'name' - '" + req.body.name + "'. Must be string [1-32 Chars]." });
    } else if (typeof req.body.email !== "string" || !utility.validateEmail(req.body.email)) {
        logger.error(`Invalid '/register' body param - {'email':'${req.body.email}'}`);
        return res.status(400).json({ error: "Invalid syntax for 'email' - '" + req.body.email + "'." });
    } else if (typeof req.body.message !== "string" || req.body.message.length <= 0) {
        logger.error(`Invalid '/message' body param - {'message':'${req.body.message}'}. Must be non-empty string`);
        return res
            .status(400)
            .json({ error: "Invalid value for 'email' - '" + req.body.email + "'. Must be string [1-32 Chars]." });
    }

    // Mailing client details
    const mailoptions = {
        from: req.body.email,
        to: "national.creche@gmail.com",
        subject: `You got a new mail from visitor - '${req.body.name}' [${req.body.email}]`,
        text: req.body.message + `\n\n Reply - mailto:${req.body.email}`,
    };
    transport
        .sendMail(mailoptions)
        .then((success) => {
            // Mail Sent
            logger.info(`Received mail from - '${req.body.email}'`);
            return res.sendStatus(200);
        })
        .catch((err) => {
            // Error sending mail
            logger.error(`Error sending mail - ${err}`);
            return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
        });
});

module.exports = router;
