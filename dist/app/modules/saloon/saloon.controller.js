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
exports.saloonController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const saloon_service_1 = require("./saloon.service");
const pickValidFields_1 = require("../../utils/pickValidFields");
const saloon_validation_1 = require("./saloon.validation");
const client_1 = require("@prisma/client");
const manageBookings = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield saloon_service_1.saloonService.manageBookingsIntoDb(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Bookings managed successfully',
        data: result,
    });
}));
const getBarberDashboard = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield saloon_service_1.saloonService.getBarberDashboardFromDb(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Barber dashboard data retrieved successfully',
        data: result,
    });
}));
const getCustomerBookings = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const filters = (0, pickValidFields_1.pickValidFields)(req.query, [
        'page',
        'limit',
        'sortBy',
        'sortOrder',
        'searchTerm',
        'startDate',
        'endDate',
        'status',
        'date',
        'appointmentAt',
    ]);
    const result = yield saloon_service_1.saloonService.getCustomerBookingsFromDb(user.id, filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Customer bookings retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getTransactions = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const filters = (0, pickValidFields_1.pickValidFields)(req.query, [
        'page',
        'limit',
        'sortBy',
        'sortOrder',
        'searchTerm',
        'startDate',
        'endDate',
        'status',
    ]);
    const result = yield saloon_service_1.saloonService.getTransactionsFromDb(user.id, filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Transactions retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getAllBarbers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    const saloonId = req.params.id;
    const result = yield saloon_service_1.saloonService.getAllBarbersFromDb(user.id, filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Barber list retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getRemainingBarbersToSchedule = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    const result = yield saloon_service_1.saloonService.getRemainingBarbersToScheduleFromDb(user.id, filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Remaining barbers to schedule retrieved successfully',
        data: result,
        // meta: result.meta,
    });
}));
const terminateBarber = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield saloon_service_1.saloonService.terminateBarberIntoDb(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Barber terminated successfully',
        data: result,
    });
}));
const getScheduledBarbers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const parsed = saloon_validation_1.saloonValidation.availableBarbersSchema.parse({
        query: req.query,
    });
    const result = yield saloon_service_1.saloonService.getScheduledBarbersFromDb(user.id, parsed.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Scheduled barbers retrieved successfully',
        data: result,
    });
}));
const getFreeBarbersOnADate = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const parsed = saloon_validation_1.saloonValidation.availableFreeBarbersSchema.parse({
        query: req.query,
    });
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
    const date = parsed.query.utcDateTime;
    const result = yield saloon_service_1.saloonService.getFreeBarbersOnADateFromDb(user.id, date, filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Free barbers on the selected date retrieved successfully',
        data: result,
        // meta: result.meta,
    });
}));
const getASaloonById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield saloon_service_1.saloonService.getASaloonByIdFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon details retrieved successfully',
        data: result,
    });
}));
const updateSaloonQueueControl = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const subscriptionPlanName = user.subscriptionPlan;
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.FREE ||
        subscriptionPlanName === client_1.SubscriptionPlanStatus.BASIC_PREMIUM) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.FORBIDDEN,
            success: false,
            message: 'Access denied. Upgrade your subscription to access hired barbers.',
            data: null,
        });
    }
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.ADVANCED_PREMIUM ||
        client_1.SubscriptionPlanStatus.PRO_PREMIUM) {
        const result = yield saloon_service_1.saloonService.updateSaloonQueueControlIntoDb(user.id, req.body);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Saloon queue control updated successfully',
            data: result,
        });
    }
}));
const deleteSaloon = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield saloon_service_1.saloonService.deleteSaloonItemFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon deleted successfully',
        data: result,
    });
}));
exports.saloonController = {
    manageBookings,
    getBarberDashboard,
    getTransactions,
    getCustomerBookings,
    getAllBarbers,
    getRemainingBarbersToSchedule,
    getFreeBarbersOnADate,
    getASaloonById,
    terminateBarber,
    getScheduledBarbers,
    updateSaloonQueueControl,
    deleteSaloon,
};
