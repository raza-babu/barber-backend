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
exports.reviewController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const review_service_1 = require("./review.service");
const client_1 = require("@prisma/client");
const multipleFile_1 = require("../../utils/multipleFile");
const createReview = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = req.user;
    const { files, body } = req;
    const uploads = {
        reviewImages: [],
    };
    const fileGroups = files || {};
    // Upload portfolio images (optional)
    if ((_a = fileGroups === null || fileGroups === void 0 ? void 0 : fileGroups.reviewImages) === null || _a === void 0 ? void 0 : _a.length) {
        const uploadedImages = yield Promise.all(fileGroups.reviewImages.map(file => (0, multipleFile_1.uploadFileToSpace)(file, 'booking-review-images')));
        uploads.reviewImages.push(...uploadedImages);
    }
    if (uploads.reviewImages.length) {
        body.images = uploads.reviewImages;
    }
    const payload = Object.assign({}, body);
    const result = yield review_service_1.reviewService.createReviewIntoDb(user.id, payload);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Review created successfully',
        data: result,
    });
}));
const getReviewListForSaloon = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield review_service_1.reviewService.getReviewListForSaloonFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Review list retrieved successfully',
        data: result,
    });
}));
const getReviewListForBarber = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const userRole = user.role;
    if (userRole === client_1.UserRoleEnum.BARBER) {
        const result = yield review_service_1.reviewService.getReviewListForBarberFromDb(user.id);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Review list for barber retrieved successfully',
            data: result,
        });
    }
    else {
        const result = yield review_service_1.reviewService.getReviewListForSaloonFromDb(user.id, req.params.id);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Review list for saloon owners retrieved successfully',
            data: result,
        });
    }
}));
const getNotProvidedForSaloonList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield review_service_1.reviewService.getNotProvidedReviewsForSaloonFromDb(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Not provided reviews for saloon retrieved successfully',
        data: result,
    });
}));
const getReviewById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield review_service_1.reviewService.getReviewByIdFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Review details retrieved successfully',
        data: result,
    });
}));
const updateReview = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = req.user;
    const { files, body } = req;
    const uploads = {
        reviewImages: [],
    };
    const fileGroups = files || {};
    // Upload portfolio images (optional)
    if ((_a = fileGroups === null || fileGroups === void 0 ? void 0 : fileGroups.reviewImages) === null || _a === void 0 ? void 0 : _a.length) {
        const uploadedImages = yield Promise.all(fileGroups.reviewImages.map(file => (0, multipleFile_1.uploadFileToSpace)(file, 'booking-review-images')));
        uploads.reviewImages.push(...uploadedImages);
    }
    if (uploads.reviewImages.length) {
        body.images = uploads.reviewImages;
    }
    const payload = Object.assign({}, body);
    const result = yield review_service_1.reviewService.updateReviewIntoDb(user.id, req.params.id, payload);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Review updated successfully',
        data: result,
    });
}));
const deleteReview = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield review_service_1.reviewService.deleteReviewItemFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Review deleted successfully',
        data: result,
    });
}));
exports.reviewController = {
    createReview,
    getReviewListForSaloon,
    getReviewListForBarber,
    getNotProvidedForSaloonList,
    getReviewById,
    updateReview,
    deleteReview,
};
