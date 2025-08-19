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
exports.barberHolidayController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const barberHoliday_service_1 = require("./barberHoliday.service");
const createBarberHoliday = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield barberHoliday_service_1.barberHolidayService.createBarberHolidayIntoDb(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'BarberHoliday created successfully',
        data: result,
    });
}));
const getBarberHolidayList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield barberHoliday_service_1.barberHolidayService.getBarberHolidayListFromDb(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'BarberHoliday list retrieved successfully',
        data: result,
    });
}));
const getBarberHolidayById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield barberHoliday_service_1.barberHolidayService.getBarberHolidayByIdFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'BarberHoliday details retrieved successfully',
        data: result,
    });
}));
const updateBarberHoliday = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield barberHoliday_service_1.barberHolidayService.updateBarberHolidayIntoDb(user.id, req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'BarberHoliday updated successfully',
        data: result,
    });
}));
const deleteBarberHoliday = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield barberHoliday_service_1.barberHolidayService.deleteBarberHolidayItemFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'BarberHoliday deleted successfully',
        data: result,
    });
}));
exports.barberHolidayController = {
    createBarberHoliday,
    getBarberHolidayList,
    getBarberHolidayById,
    updateBarberHoliday,
    deleteBarberHoliday,
};
