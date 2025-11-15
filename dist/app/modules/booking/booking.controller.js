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
exports.bookingController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const booking_service_1 = require("./booking.service");
const booking_validation_1 = require("./booking.validation");
const pickValidFields_1 = require("../../utils/pickValidFields");
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const createBooking = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (req.body.bookingType === undefined) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking type is required');
    }
    console.log('Booking Type:', req.body.bookingType);
    if (req.body.bookingType === client_1.BookingType.QUEUE) {
        const result = yield booking_service_1.bookingService.createQueueBookingIntoDb(user.id, req.body);
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.CREATED,
            success: true,
            message: 'Queue booking created successfully',
            data: result,
        });
    }
    const result = yield booking_service_1.bookingService.createBookingIntoDb(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Booking created successfully',
        data: result,
    });
}));
const getBookingList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield booking_service_1.bookingService.getBookingListFromDb(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Booking list retrieved successfully',
        data: result,
    });
}));
const getBookingListForSalonOwner = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        'appointmentAt',
        'date',
    ]);
    const result = yield booking_service_1.bookingService.getBookingListForSalonOwnerFromDb(user.id, filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Booking list for salon owner retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
}));
const getAvailableBarbers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const parsed = booking_validation_1.bookingValidation.availableBarbersSchema.parse({
        query: req.query,
    });
    // console.log('Parsed query:', parsed.query);
    const result = yield booking_service_1.bookingService.getAvailableBarbersFromDb(user.id, parsed.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Available barbers retrieved successfully',
        data: result,
    });
}));
const getAvailableBarbersForWalkingIn = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const saloonId = req.params.saloonId;
    const type = req.params.type;
    if (type !== client_1.ScheduleType.BOOKING && type !== client_1.ScheduleType.QUEUE) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid schedule type. It must be either BOOKING or QUEUE.');
    }
    const date = req.query.date;
    const result = yield booking_service_1.bookingService.getAllBarbersForQueueFromDb(user.id, saloonId, type, date, user.role);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Available barbers for walking-in retrieved successfully',
        data: result,
    });
}));
const getAvailableABarberForWalkingIn = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const saloonId = req.params.saloonId;
    const barberId = req.params.barberId;
    const date = req.query.date;
    const result = yield booking_service_1.bookingService.getAvailableABarberForWalkingInFromDb(user.id, saloonId, barberId, date);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Available barber for walking-in retrieved successfully',
        data: result,
    });
}));
const getBookingByIdForSalonOwner = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield booking_service_1.bookingService.getBookingByIdFromDbForSalon(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Booking details for salon owner retrieved successfully',
        data: result,
    });
}));
const getBookingById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield booking_service_1.bookingService.getBookingByIdFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Booking details retrieved successfully',
        data: result,
    });
}));
const updateBooking = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield booking_service_1.bookingService.updateBookingIntoDb(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Booking updated successfully',
        data: result,
    });
}));
const updateBookingStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield booking_service_1.bookingService.updateBookingStatusIntoDb(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Booking status updated successfully',
        data: result,
    });
}));
const cancelBooking = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield booking_service_1.bookingService.cancelBookingIntoDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Booking cancelled successfully',
        data: result,
    });
}));
const deleteBooking = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield booking_service_1.bookingService.deleteBookingItemFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Booking deleted successfully',
        data: result,
    });
}));
const getLoyaltySchemesForACustomer = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield booking_service_1.bookingService.getLoyaltySchemesForCustomerFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Loyalty schemes retrieved successfully',
        data: result,
    });
}));
exports.bookingController = {
    createBooking,
    getBookingList,
    getBookingListForSalonOwner,
    getBookingByIdForSalonOwner,
    getAvailableBarbersForWalkingIn,
    getAvailableABarberForWalkingIn,
    getAvailableBarbers,
    getBookingById,
    updateBooking,
    updateBookingStatus,
    cancelBooking,
    deleteBooking,
    getLoyaltySchemesForACustomer,
};
