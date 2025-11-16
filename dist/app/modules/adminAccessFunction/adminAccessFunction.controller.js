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
exports.adminAccessFunctionController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const adminAccessFunction_service_1 = require("./adminAccessFunction.service");
const multipleFile_1 = require("../../utils/multipleFile");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const pickValidFields_1 = require("../../utils/pickValidFields");
const createAdminAccessFunction = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { file, body } = req;
    if (!file) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Profile image file is required.');
    }
    // Upload to DigitalOcean
    const fileUrl = yield (0, multipleFile_1.uploadFileToSpace)(file, 'admin-profile-images');
    const accessFunctionData = Object.assign(Object.assign({}, body), { image: fileUrl });
    const result = yield adminAccessFunction_service_1.adminAccessFunctionService.createAdminAccessFunctionIntoDb(user.id, accessFunctionData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'AdminAccessFunction created successfully',
        data: result,
    });
}));
const getAdminAccessFunctionList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const filters = (0, pickValidFields_1.pickValidFields)(req.query, [
        'page',
        'limit',
        'sortBy',
        'sortOrder',
        'searchTerm',
        'role',
        'isSuperAdmin',
        'startDate',
        'endDate',
    ]);
    const result = yield adminAccessFunction_service_1.adminAccessFunctionService.getAdminAccessFunctionListFromDb(filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'AdminAccessFunction list retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getAdminAccessFunctionById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield adminAccessFunction_service_1.adminAccessFunctionService.getAdminAccessFunctionByIdFromDb(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'AdminAccessFunction details retrieved successfully',
        data: result,
    });
}));
const updateAdminAccessFunction = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield adminAccessFunction_service_1.adminAccessFunctionService.updateAdminAccessFunctionIntoDb(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'AdminAccessFunction updated successfully',
        data: result,
    });
}));
const deleteAdminAccessFunction = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield adminAccessFunction_service_1.adminAccessFunctionService.deleteAdminAccessFunctionItemFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'AdminAccessFunction deleted successfully',
        data: result,
    });
}));
exports.adminAccessFunctionController = {
    createAdminAccessFunction,
    getAdminAccessFunctionList,
    getAdminAccessFunctionById,
    updateAdminAccessFunction,
    deleteAdminAccessFunction,
};
