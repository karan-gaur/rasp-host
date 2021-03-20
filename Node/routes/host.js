const express = require("express");

const config = require("../config");
const utility = require("../utility");
const constants = require("../constants");
const { USER_STORAGE_LIMIT } = require("../config");

const router = express.Router();
const logger = constants.LOGGER;

// Update user storage limit
router.post("/storageLimit", utility.checkAuthentication, (req, res) => {
    try {
        if (req.body.token.admin) {
            User.findOne({ email: req.body.email }).then((usr) => {
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
    } catch (err) {
        logger.error(`Error updating storageLimit for user - '${req.body.token.email}'. Error - ${err}`);
        return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
    }
});

// Get user's list using pagination for lazy loading
router.get("/getUsers", [utility.checkAuthentication, utility.checkAuthorization], (req, res) => {
    try {
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);

        // Validating query params
        if (isNaN(limit) || isNaN(page)) {
            logger.error(
                `Query values are not a Number for endpoint - '/getUsers' - {'page':${req.query.page}, ` +
                    `'limit':${req.query.limit}, 'email':'${req.body.token.email}'}`
            );
            return res.status(400).json({ error: "Invalid query params - {'limit':Number, 'page':Number}" });
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
                }
                return res.status(200).json({
                    users: users,
                });
            });
    } catch (err) {
        logger.error(`Error fetching paginated users - '${req.body.token.email}'. Error - ${err}`);
        return res.status(500).json({ error: "Internal server error. Contact System Administrator" });
    }
});

module.exports = router;
