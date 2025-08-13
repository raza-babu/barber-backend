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
exports.favoriteFeedController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const favoriteFeed_service_1 = require("./favoriteFeed.service");
const createFavoriteFeed = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield favoriteFeed_service_1.favoriteFeedService.createFavoriteFeedIntoDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'FavoriteFeed created successfully',
        data: result,
    });
}));
const getFavoriteFeedList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield favoriteFeed_service_1.favoriteFeedService.getFavoriteFeedListFromDb();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'FavoriteFeed list retrieved successfully',
        data: result,
    });
}));
const getFavoriteFeedById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield favoriteFeed_service_1.favoriteFeedService.getFavoriteFeedByIdFromDb(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'FavoriteFeed details retrieved successfully',
        data: result,
    });
}));
const updateFavoriteFeed = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield favoriteFeed_service_1.favoriteFeedService.updateFavoriteFeedIntoDb(user.id, req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'FavoriteFeed updated successfully',
        data: result,
    });
}));
const deleteFavoriteFeed = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield favoriteFeed_service_1.favoriteFeedService.deleteFavoriteFeedItemFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'FavoriteFeed deleted successfully',
        data: result,
    });
}));
exports.favoriteFeedController = {
    createFavoriteFeed,
    getFavoriteFeedList,
    getFavoriteFeedById,
    updateFavoriteFeed,
    deleteFavoriteFeed,
};
