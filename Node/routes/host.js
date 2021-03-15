const express = require("express");

const config = require("../config");
const utility = require("../utility");
const constants = require("../constants");

const router = express.Router();
const logger = constants.LOGGER;

// Update user storage limit
router.post("/storageLimit", utility.checkAuthentication, (req, res) => {
    if (req.body.token.admin) {
        User.findOne({ email: req.body.email }, (err, usr) => {
            if (err) {
                logger.error(`Error querring DB - '${err}`);
                return res.status(500).json({
                    error: "Internal server error. Contact System Administrator",
                });
            } else if (usr) {
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
                loggger.error(`No such user - '${req.body.token.email}`);
                return res.status(404).json({
                    error: "Invalid username/password. Please re-login",
                });
            }
        });
    } else {
        logger.warn(`Non-admin user tried updating user storage - '${req.body.token.email}`);
        return res.status(401).json({ error: "Unauthorized user. Admin credentials required." });
    }
});

module.exports = router;
