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
const analyzeSaloonFromImage = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield customer_service_1.customerService.analyzeSaloonFromImageInDb(user.id, req.file);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon analyzed successfully',
        data: result,
    });
}));
const getAllSaloonList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { searchTerm, page, limit, sortBy, minRating, latitude, longitude, radius, topRated } = req.query;
    // If latitude and longitude are provided, get nearest saloons
    if (latitude && longitude && !topRated) {
        const query = {
            radius: radius ? Number(radius) : undefined,
            searchTerm: searchTerm,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            minRating: minRating ? Number(minRating) : undefined,
        };
        const result = yield customer_service_1.customerService.getMyNearestSaloonListFromDb(user.id, Number(latitude), Number(longitude), query);
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Nearby saloons retrieved successfully',
            data: result.data,
            meta: result.meta,
        });
    }
    // If topRated is true, get top rated saloons
    if (topRated && !(latitude || longitude)) {
        const query = {
            searchTerm: searchTerm,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            minRating: minRating ? Number(minRating) : undefined,
        };
        const result = yield customer_service_1.customerService.getTopRatedSaloonsFromDb(user.id, query);
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
    const result = yield customer_service_1.customerService.getAllSaloonListFromDb(user.id, query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon list retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getMyNearestSaloonList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { latitude, longitude, radius, searchTerm, page, limit, minRating } = req.query;
    const query = {
        radius: radius ? Number(radius) : undefined,
        searchTerm: searchTerm,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        minRating: minRating ? Number(minRating) : undefined,
    };
    const result = yield customer_service_1.customerService.getMyNearestSaloonListFromDb(user.id, Number(latitude), Number(longitude), query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Nearby saloons retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getTopRatedSaloons = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { searchTerm, page, limit, minRating } = req.query;
    const query = {
        searchTerm: searchTerm,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        minRating: minRating ? Number(minRating) : undefined,
    };
    const result = yield customer_service_1.customerService.getTopRatedSaloonsFromDb(user.id, query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Top rated saloons retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const addSaloonToFavorites = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield customer_service_1.customerService.addSaloonToFavoritesInDb(user.id, req.body.saloonId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon added to favorites successfully',
        data: result,
    });
}));
const getFavoriteSaloons = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { page, limit } = req.query;
    const query = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
    };
    const result = yield customer_service_1.customerService.getFavoriteSaloonsFromDb(user.id, query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Favorite saloons retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const removeSaloonFromFavorites = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield customer_service_1.customerService.removeSaloonFromFavoritesInDb(user.id, req.params.saloonId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon removed from favorites successfully',
        data: result,
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
const getVisitedSaloonList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { page, limit } = req.query;
    const query = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
    };
    const result = yield customer_service_1.customerService.getVisitedSaloonListFromDb(user.id, query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Visited saloons retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getMyLoyaltyOffers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield customer_service_1.customerService.getMyLoyaltyOffersFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Loyalty offers retrieved successfully',
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
    analyzeSaloonFromImage,
    getAllSaloonList,
    getMyNearestSaloonList,
    getTopRatedSaloons,
    getSaloonAllServicesList,
    getVisitedSaloonList,
    getMyLoyaltyOffers,
    addSaloonToFavorites,
    getFavoriteSaloons,
    removeSaloonFromFavorites,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
};
