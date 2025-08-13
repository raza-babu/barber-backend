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
exports.supportRepliesController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const supportReplies_service_1 = require("./supportReplies.service");
const pickValidFields_1 = require("../../utils/pickValidFields");
const createSupportReplies = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield supportReplies_service_1.supportRepliesService.createSupportRepliesIntoDb(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'SupportReplies created successfully',
        data: result,
    });
}));
const getSupportRepliesList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const filters = (0, pickValidFields_1.pickValidFields)(req.query, [
        'page',
        'limit',
        'sortBy',
        'sortOrder',
        'searchTerm',
        'status',
        'type',
        'startDate',
        'endDate',
    ]);
    const result = yield supportReplies_service_1.supportRepliesService.getSupportRepliesListFromDb(filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'SupportReplies list retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getSupportRepliesById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield supportReplies_service_1.supportRepliesService.getSupportRepliesByIdFromDb(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'SupportReplies details retrieved successfully',
        data: result,
    });
}));
const getSupportRepliesReports = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const filters = (0, pickValidFields_1.pickValidFields)(req.query, [
        'page',
        'limit',
        'sortBy',
        'sortOrder',
        'searchTerm',
        'status',
        'startDate',
        'endDate',
    ]);
    const result = yield supportReplies_service_1.supportRepliesService.getSupportRepliesReportsFromDb(filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'SupportReplies reports retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const updateSupportReplies = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield supportReplies_service_1.supportRepliesService.updateSupportRepliesIntoDb(user.id, req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'SupportReplies updated successfully',
        data: result,
    });
}));
const deleteSupportReplies = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield supportReplies_service_1.supportRepliesService.deleteSupportRepliesItemFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'SupportReplies deleted successfully',
        data: result,
    });
}));
exports.supportRepliesController = {
    createSupportReplies,
    getSupportRepliesList,
    getSupportRepliesById,
    updateSupportReplies,
    deleteSupportReplies,
    getSupportRepliesReports,
};
