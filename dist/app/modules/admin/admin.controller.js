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
exports.adminController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const admin_service_1 = require("./admin.service");
const pickValidFields_1 = require("../../utils/pickValidFields");
const getSaloonList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const filters = (0, pickValidFields_1.pickValidFields)(req.query, [
        'page',
        'limit',
        'sortBy',
        'sortOrder',
        'searchTerm',
        'status',
        'isVerified',
        'startDate',
        'endDate',
    ]);
    const result = yield admin_service_1.adminService.getSaloonFromDb(user.id, filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon list retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const blockSaloonById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield admin_service_1.adminService.blockSaloonByIdIntoDb(req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon status updated successfully',
        data: result,
    });
}));
const getBarbersList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const filters = (0, pickValidFields_1.pickValidFields)(req.query, [
        'page',
        'limit',
        'sortBy',
        'sortOrder',
        'searchTerm',
        'status',
        'experienceYears',
        'startDate',
        'endDate',
    ]);
    const result = yield admin_service_1.adminService.getBarbersListFromDb(filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Barbers list retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const blockBarberById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield admin_service_1.adminService.blockBarberByIdIntoDb(user.id, req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Barber status updated successfully',
        data: result,
    });
}));
const getCustomersList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    const result = yield admin_service_1.adminService.getCustomersListFromDb(user.id, filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Customers list retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const blockCustomerById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield admin_service_1.adminService.blockCustomerByIdIntoDb(user.id, req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Customer status updated successfully',
        data: result,
    });
}));
const updateSaloonOwnerById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield admin_service_1.adminService.updateSaloonOwnerByIdIntoDb(user.id, req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon owner updated successfully',
        data: result,
    });
}));
const getAdminDashboard = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield admin_service_1.adminService.getAdminDashboardFromDb(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Admin dashboard data retrieved successfully',
        data: result,
    });
}));
exports.adminController = {
    getSaloonList,
    blockSaloonById,
    getBarbersList,
    blockBarberById,
    getCustomersList,
    blockCustomerById,
    updateSaloonOwnerById,
    getAdminDashboard,
};
