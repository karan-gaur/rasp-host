"use strict";
const winston = require("winston");
const path = require('path')
require('winston-daily-rotate-file');

module.exports = {
    ZIP: ".zip",
    ZIP_PATH: path.join(__dirname, "public", "zip"),
    TEMP_FOLDER_PATH: path.join(__dirname, "public", "temp"),
    LOGGER: winston.createLogger({
        transports: [
            new (winston.transports.DailyRotateFile)({
                level: "info",
                filename: path.join(__dirname, "logs", "raspHost-%DATE%.log"),
                handleExceptions: true,
                frequency: "1d",
                zippedArchive: true,
                maxSize: "20m",
                maxFiles: "30d"
            }),
            new (winston.transports.Console)({
                level: 'debug',
                handleExceptions: true,
                colorize: true, 
                json: false
            })
        ],
        exitOnError: false
    })
};
