"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFileFromSpace = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const config_1 = __importDefault(require("../../config"));
// Configure DigitalOcean Spaces
const s3 = new client_s3_1.S3Client({
    region: 'nyc3',
    endpoint: config_1.default.s3.do_space_endpoint,
    credentials: {
        accessKeyId: config_1.default.s3.do_space_accesskey || '', // Ensure this is never undefined
        secretAccessKey: config_1.default.s3.do_space_secret_key || '', // Ensure this is never undefined
    },
});
const deleteFileFromSpace = (fileUrl) => __awaiter(void 0, void 0, void 0, function* () {
    if (!process.env.DO_SPACE_BUCKET) {
        throw new Error('DO_SPACE_BUCKET is not defined in the environment variables.');
    }
    // Example URL: https://my-bucket.nyc3.digitaloceanspaces.com/folder/12345_image.png
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // remove leading "/"
    const params = {
        Bucket: process.env.DO_SPACE_BUCKET,
        Key: key,
    };
    try {
        yield s3.send(new client_s3_1.DeleteObjectCommand(params));
        console.log(`Deleted file: ${key}`);
    }
    catch (error) {
        console.error('Error deleting file:', error);
        throw error;
    }
});
exports.deleteFileFromSpace = deleteFileFromSpace;
