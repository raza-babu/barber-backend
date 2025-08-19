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
exports.adsController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const ads_service_1 = require("./ads.service");
const multipleFile_1 = require("../../utils/multipleFile");
const createAds = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = req.user;
    const { files, body } = req;
    const uploads = {
        images: [],
    };
    const fileGroups = files;
    // Upload images
    if ((_a = fileGroups.images) === null || _a === void 0 ? void 0 : _a.length) {
        const imageUploads = yield Promise.all(fileGroups.images.map(file => (0, multipleFile_1.uploadFileToSpace)(file, 'ads-images')));
        uploads.images.push(...imageUploads);
    }
    const adsData = Object.assign(Object.assign({}, body), { images: uploads.images });
    const result = yield ads_service_1.adsService.createAdsIntoDb(user.id, adsData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Ads created successfully',
        data: result,
    });
}));
const getAdsList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield ads_service_1.adsService.getAdsListFromDb();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Ads list retrieved successfully',
        data: result,
    });
}));
const getAdsById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield ads_service_1.adsService.getAdsByIdFromDb(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Ads details retrieved successfully',
        data: result,
    });
}));
const updateAds = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const user = req.user;
    const { files, body } = req;
    const uploads = {
        images: [],
    };
    const fileGroups = files;
    // Upload images
    if ((_b = fileGroups.images) === null || _b === void 0 ? void 0 : _b.length) {
        const imageUploads = yield Promise.all(fileGroups.images.map(file => (0, multipleFile_1.uploadFileToSpace)(file, 'ads-images')));
        uploads.images.push(...imageUploads);
    }
    const adsData = Object.assign(Object.assign({}, body), { images: uploads.images });
    const result = yield ads_service_1.adsService.updateAdsIntoDb(user.id, req.params.id, adsData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Ads updated successfully',
        data: result,
    });
}));
const deleteAds = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield ads_service_1.adsService.deleteAdsItemFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Ads deleted successfully',
        data: result,
    });
}));
exports.adsController = {
    createAds,
    getAdsList,
    getAdsById,
    updateAds,
    deleteAds,
};
