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
exports.jobApplicationsController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const jobApplications_service_1 = require("./jobApplications.service");
const pickValidFields_1 = require("../../utils/pickValidFields");
const createJobApplications = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield jobApplications_service_1.jobApplicationsService.createJobApplicationsIntoDb(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'JobApplications created successfully',
        data: result,
    });
}));
const getJobApplicationsList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const filters = (0, pickValidFields_1.pickValidFields)(req.query, [
        'page',
        'limit',
        'sortBy',
        'sortOrder',
        'searchTerm',
        'status',
        'jobPostId',
        'startDate',
        'endDate',
    ]);
    const result = yield jobApplications_service_1.jobApplicationsService.getJobApplicationsListFromDb(user.id, filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'JobApplications list retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getJobApplicationsById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield jobApplications_service_1.jobApplicationsService.getJobApplicationsByIdFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'JobApplications details retrieved successfully',
        data: result,
    });
}));
const getHiredBarbersList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const filters = (0, pickValidFields_1.pickValidFields)(req.query, [
        'page',
        'limit',
        'sortBy',
        'sortOrder',
        'searchTerm',
        'startDate',
        'endDate',
    ]);
    const result = yield jobApplications_service_1.jobApplicationsService.getHiredBarbersListFromDb(user.id, filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Hired Barbers list retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const updateJobApplications = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield jobApplications_service_1.jobApplicationsService.updateJobApplicationsIntoDb(user.id, req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'JobApplications updated successfully',
        data: result,
    });
}));
const deleteJobApplications = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield jobApplications_service_1.jobApplicationsService.deleteJobApplicationsItemFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'JobApplications deleted successfully',
        data: result,
    });
}));
exports.jobApplicationsController = {
    createJobApplications,
    getJobApplicationsList,
    getJobApplicationsById,
    getHiredBarbersList,
    updateJobApplications,
    deleteJobApplications,
};
