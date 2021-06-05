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
    sessionKey: "CheckCookieCheck",
    DB_CONNECT_STRING: "mongodb://127.0.0.1:27017/raspHost",

    // Cache Configurations
    ENABLE_CACHE: true,
    REDIS_PORT: 6379,

    // Token configurations
    ACCESS_TOKEN_SECRET_KEY: "Check_JWT_authentication",
    ACCESS_TOKEN_EXPIRY: "30m",
    REFRESH_TOKEN_SECRET_KEY: "SECRET_TOKEN_AUTHENTICATION",
    REFRESH_TOKEN_EXPIRY: "30d",

    // User Configuration properties
    USER_STORAGE_LIMIT: 1024 * 1024 * 1024 * 10, // 10 GB - Value in bytes
    USER_DEVICE_LIMIT: 10,

    // File CHECKS
    STREAM_SUPPORTED_EXTENSIONS: {
        mp4: "video/mp4",
        jpeg: "image/jpeg",
        png: "image/png",
        mp3: "audio/mpeg",
        pdf: "application/pdf",
    },
    MAX_FILE_SIZE_FOR_EDIT: 1024 * 1024 * 10, // 10 MB - Value in bytes

    // Admin Configurations
    ADMIN_NAME: "Admin",
    ADMIN_EMAIL: "admin@g.com",
    ADMIN_PASS: "1",
};
