"use strict";

const winston = require("winston");
const path = require("path");
require("winston-daily-rotate-file");

module.exports = {
    DATA_DUMP: path.join(__dirname, "public", "data"),
    LOGGER: winston.createLogger({
        transports: [
            new winston.transports.DailyRotateFile({
                filename: path.join(__dirname, "logs", "raspHost.log"),
                handleExceptions: true,
                frequency: "1d",
                zippedArchive: true,
                maxSize: "20m",
                maxFiles: "30d",
                timestamp: true,
            }),
            new winston.transports.Console({
                level: "debug",
                handleExceptions: true,
                colorize: true,
                json: false,
                timestamp: true,
            }),
        ],
        exitOnError: false,
    }),
};
