"use strict";

module.exports = {
    // Mailing properties for contacting admin
    mailer: {
        host: "smtp.gmail.com",
        secure: true,
        auth: {
            user: "national.creche@gmail.com",
            pass: "creche123",
        },
    },

    // Server configurations
    SALT: 10,
    REDIS_PORT: 6379,
    sessionKey: "CheckCookieCheck",
    DB_CONNECT_STRING: "mongodb://127.0.0.1:27017/raspHost",

    // Token configurations
    ACCESS_TOKEN_SECRET_KEY: "Check_JWT_authentication",
    ACCESS_TOKEN_EXPIRY: "30m",
    REFRESH_TOKEN_SECRET_KEY: "SECRET_TOKEN_AUTHENTICATION",
    REFRESH_TOKEN_EXPIRY: "30d",

    // User Configuration properties
    USER_STORAGE_LIMIT: 1024 * 1024 * 1024 * 10, // 10 GB - Value in bytes
    USER_DEVICE_LIMIT: 10,

    // Admin Configurations
    ADMIN_NAME: "Gochi",
    ADMIN_EMAIL: "gochi@g.com",
    ADMIN_PASS: "1",
};
