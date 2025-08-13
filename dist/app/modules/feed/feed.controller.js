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
exports.feedController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const feed_service_1 = require("./feed.service");
const multipleFile_1 = require("../../utils/multipleFile");
const createFeed = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = req.user;
    const { files, body } = req;
    const uploads = {
        images: [],
    };
    const fileGroups = files;
    // Upload images
    if ((_a = fileGroups.images) === null || _a === void 0 ? void 0 : _a.length) {
        const imageUploads = yield Promise.all(fileGroups.images.map(file => (0, multipleFile_1.uploadFileToSpace)(file, 'feed-images')));
        uploads.images.push(...imageUploads);
    }
    const feedData = Object.assign(Object.assign({}, body), { images: uploads.images });
    const result = yield feed_service_1.feedService.createFeedIntoDb(user.id, feedData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Feed created successfully',
        data: result,
    });
}));
const getFeedList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield feed_service_1.feedService.getFeedListFromDb(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Feed list retrieved successfully',
        data: result,
    });
}));
const getFeedById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield feed_service_1.feedService.getFeedByIdFromDb(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Feed details retrieved successfully',
        data: result,
    });
}));
const updateFeed = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const user = req.user;
    const { files, body } = req;
    const uploads = {
        images: [],
    };
    const fileGroups = files;
    // Upload images
    if ((_b = fileGroups.images) === null || _b === void 0 ? void 0 : _b.length) {
        const imageUploads = yield Promise.all(fileGroups.images.map(file => (0, multipleFile_1.uploadFileToSpace)(file, 'feed-images')));
        uploads.images.push(...imageUploads);
    }
    const feedData = Object.assign(Object.assign({}, body), { images: uploads.images });
    if (uploads.images.length === 0) {
        delete feedData.images; // Remove images if no new images are uploaded
    }
    const result = yield feed_service_1.feedService.updateFeedIntoDb(user.id, req.params.id, feedData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Feed updated successfully',
        data: result,
    });
}));
const deleteFeed = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield feed_service_1.feedService.deleteFeedItemFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Feed deleted successfully',
        data: result,
    });
}));
exports.feedController = {
    createFeed,
    getFeedList,
    getFeedById,
    updateFeed,
    deleteFeed,
};
