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
exports.jobPostController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const jobPost_service_1 = require("./jobPost.service");
const pickValidFields_1 = require("../../utils/pickValidFields");
const createJobPost = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield jobPost_service_1.jobPostService.createJobPostIntoDb(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'JobPost created successfully',
        data: result,
    });
}));
const getJobPostList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const filters = (0, pickValidFields_1.pickValidFields)(req.query, [
        'page',
        'limit',
        'sortBy',
        'sortOrder',
        'searchTerm',
        'isActive',
        'salaryMin',
        'salaryMax',
        'experienceRequired',
        'startDate',
        'endDate',
    ]);
    const result = yield jobPost_service_1.jobPostService.getJobPostListFromDb(filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'JobPost list retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getJobPostById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield jobPost_service_1.jobPostService.getJobPostByIdFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'JobPost details retrieved successfully',
        data: result,
    });
}));
const updateJobPost = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield jobPost_service_1.jobPostService.updateJobPostIntoDb(user.id, req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'JobPost updated successfully',
        data: result,
    });
}));
const toggleJobPostActive = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield jobPost_service_1.jobPostService.toggleJobPostActiveIntoDb(user.id, req.params.jobPostId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'JobPost active status toggled successfully',
        data: result,
    });
}));
const deleteJobPost = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield jobPost_service_1.jobPostService.deleteJobPostItemFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'JobPost deleted successfully',
        data: result,
    });
}));
exports.jobPostController = {
    createJobPost,
    getJobPostList,
    getJobPostById,
    updateJobPost,
    toggleJobPostActive,
    deleteJobPost,
};
