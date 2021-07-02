const express = require("express");
const nodemailer = require("nodemailer");

const config = require("../config");
const constants = require("../constants");
const utility = require("../utilities/utility");
const check = require("../utilities/validationUtility");

const router = express.Router();
const logger = constants.LOGGER;
const transport = nodemailer.createTransport(config.mailer);

// Update user storage limit
router.post(
    "/storageLimit",
    [utility.checkAuthentication, utility.checkAuthorization, check.verifyEmail, check.validateStorageLimit],
    async (req, res) => {
        try {
            const usr = await User.findOne({ email: req.body.email }).exec();
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
        } catch (err) {
            logger.error(`Error updating storageLimit for user - '${req.body.token.email}'. Error - ${err}`);
            return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
        }
    }
);

// Get user's list using pagination for lazy loading
router.get(
    "/getUsers",
    [utility.checkAuthentication, utility.checkAuthorization, check.validatePaginationParams],
    (req, res) => {
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);

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
    }
);

// GET Contact Us page.
router.post("/contact", [check.validateName, check.validateEmail, check.validateContactMessage], (req, res) => {
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
