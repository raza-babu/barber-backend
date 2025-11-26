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
exports.customerController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const customer_service_1 = require("./customer.service");
const createCustomer = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield customer_service_1.customerService.createCustomerIntoDb(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Customer created successfully',
        data: result,
    });
}));
const getAllSaloonList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { searchTerm, page, limit, sortBy, minRating, latitude, longitude, radius, topRated } = req.query;
    // If latitude and longitude are provided, get nearest saloons
    if (latitude && longitude) {
        const query = {
            radius: radius ? Number(radius) : undefined,
            searchTerm: searchTerm,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            minRating: minRating ? Number(minRating) : undefined,
        };
        const result = yield customer_service_1.customerService.getMyNearestSaloonListFromDb(Number(latitude), Number(longitude), query);
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Nearby saloons retrieved successfully',
            data: result.data,
            meta: result.meta,
        });
    }
    // If topRated is true, get top rated saloons
    if (topRated === 'true') {
        const query = {
            searchTerm: searchTerm,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            minRating: minRating ? Number(minRating) : undefined,
        };
        const result = yield customer_service_1.customerService.getTopRatedSaloonsFromDb(query);
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Top rated saloons retrieved successfully',
            data: result.data,
            meta: result.meta,
        });
    }
    // Default: get all saloons
    const query = {
        searchTerm: searchTerm,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        sortBy: sortBy,
        minRating: minRating ? Number(minRating) : undefined,
    };
    const result = yield customer_service_1.customerService.getAllSaloonListFromDb(query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon list retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getMyNearestSaloonList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { latitude, longitude, radius, searchTerm, page, limit, minRating } = req.query;
    const query = {
        radius: radius ? Number(radius) : undefined,
        searchTerm: searchTerm,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        minRating: minRating ? Number(minRating) : undefined,
    };
    const result = yield customer_service_1.customerService.getMyNearestSaloonListFromDb(Number(latitude), Number(longitude), query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Nearby saloons retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getTopRatedSaloons = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { searchTerm, page, limit, minRating } = req.query;
    const query = {
        searchTerm: searchTerm,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        minRating: minRating ? Number(minRating) : undefined,
    };
    const result = yield customer_service_1.customerService.getTopRatedSaloonsFromDb(query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Top rated saloons retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getSaloonAllServicesList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield customer_service_1.customerService.getSaloonAllServicesListFromDb(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon services retrieved successfully',
        data: result,
    });
}));
const getCustomerById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield customer_service_1.customerService.getCustomerByIdFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Customer details retrieved successfully',
        data: result,
    });
}));
const updateCustomer = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield customer_service_1.customerService.updateCustomerIntoDb(user.id, req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Customer updated successfully',
        data: result,
    });
}));
const deleteCustomer = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield customer_service_1.customerService.deleteCustomerItemFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Customer deleted successfully',
        data: result,
    });
}));
exports.customerController = {
    createCustomer,
    getAllSaloonList,
    getMyNearestSaloonList,
    getTopRatedSaloons,
    getSaloonAllServicesList,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
};
