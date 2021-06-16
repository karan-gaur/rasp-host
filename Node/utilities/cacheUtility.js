const util = require("util");
const redis = require("redis");
const config = require("../config");
const constants = require("../constants");

const logger = constants.LOGGER;

// Initilize redis client
const redis_client = redis.createClient(config.REDIS_PORT);
redis_client.on("connect", () => {
    logger.info("Redis server connection established", { service: "redis" });
});

redis_get = util.promisify(redis_client.get).bind(redis_client);
redis_set = util.promisify(redis_client.set).bind(redis_client);

/**
 * Set key value pair for redis caching.
 * @param {String} key
 * @param {String} value
 */
async function set(key, value) {
    try {
        await redis_set(key, value);
    } catch (err) {
        logger.error(`Error setting cache value - ${err}`);
    }
}

/**
 * Get value for given key.
 * @param {String} key
 */
async function get(key) {
    try {
        return await redis_get(key);
    } catch (err) {
        logger.error(`Error fetching key from cache - ${err}`);
        return null;
    }
}

module.exports = {
    get_key: get,
    set_key: set,
};
