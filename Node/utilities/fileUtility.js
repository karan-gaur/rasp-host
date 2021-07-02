const fs = require("fs");
const util = require("util");
const path = require("path");
const archiver = require("archiver");

const config = require("../config");
const cache = require("./cacheUtility");
const constants = require("../constants");

const logger = constants.LOGGER;
const stat = util.promisify(fs.stat);
const readdir = util.promisify(fs.readdir);

/**
 * Evaluate folder size in Bytes
 * @param {String} dirPath
 * @throws Will throw an error if file does not exists
 * @returns {number}
 */
function getFolderSize(dirPath) {
    if (!fs.existsSync(dirPath)) {
        throw `No such file/folder - '${dirPath}'`;
    }
    stats = fs.lstatSync(dirPath);
    if (stats.isFile()) return stats.size;

    fileArray = fs.readdirSync(dirPath);
    totalFolderSize = stats.size;

    fileArray.forEach((file) => {
        stats = fs.lstatSync(path.join(dirPath, file));
        if (stats.isDirectory()) totalFolderSize += getFolderSize(path.join(dirPath, file));
        else totalFolderSize += stats.size;
    });
    return totalFolderSize;
}

/**
 * Get extenstion of the given file.
 * @param {string} fileName Name of the file.
 * @returns {string}
 */
function getFileExtension(fileName) {
    var ext = path.extname(fileName || "").split(".");
    return ext[ext.length - 1];
}

/**
 * Compress folders and save to local directory
 * @param {string} srcFolder
 * @param {string} zipFilePath
 * @returns
 */
function zipFolder(srcFolder, zipFilePath) {
    return new Promise((resolve, reject) => {
        const targetBasePath = path.dirname(zipFilePath);
        if (targetBasePath === srcFolder) {
            return reject(Error("Source and target folder must be different."));
        }

        fs.accessSync(srcFolder, fs.constants.F_OK);
        fs.accessSync(path.dirname(zipFilePath), fs.constants.F_OK);

        const output = fs.createWriteStream(zipFilePath);
        const zipArchive = archiver("zip");

        output.on("close", function () {
            resolve();
        });

        // Error while compressing the folder and writing to directory
        zipArchive.on("error", function (err) {
            return reject(err);
        });

        zipArchive.pipe(output);
        zipArchive.directory(srcFolder, false);
        zipArchive.finalize();
    });
}

/**
 * Get statistics for folder
 * @param {String} folderPath - Path of file/folder
 * @returns Array
 */
async function getFodlerStats(folderPath) {
    // Trying Cache
    let result = await cache.get_key(folderPath);

    if (result) {
        // Cache Hit
        logger.info(`Redis-cache hit for - '${folderPath}'`);
        result = JSON.parse(result);
        files = result.files;
        folders = result.folders;
    } else {
        console.log("");
        logger.info(`Redis-cache miss for - '${folderPath}'`);
        dirContents = await readdir(folderPath);
        files = [];
        folders = [];

        // Segregating files and folders in directory
        for (let i = 0; i < dirContents.length; i++) {
            const subFile = path.join(folderPath, dirContents[i]);
            const fileStats = await stat(subFile);
            if (fileStats.isDirectory()) {
                folders.push({
                    name: dirContents[i],
                    mt: fileStats.mtime,
                });
            } else {
                let extension = getFileExtension(subFile);
                files.push({
                    name: dirContents[i],
                    size: fileStats.size,
                    mt: fileStats.mtime,
                    type: extension in config.STREAM_SUPPORTED_EXTENSIONS ? extension : "file",
                });
            }
        }
        await cache.set_key(folderPath, JSON.stringify({ files: files, folders: folders }));
    }
    return { files: files, folders: folders };
}

module.exports = {
    zipFolder: zipFolder,
    getFolderSize: getFolderSize,
    getFodlerStats: getFodlerStats,
    getFileExtension: getFileExtension,
};
