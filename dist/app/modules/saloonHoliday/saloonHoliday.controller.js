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
exports.saloonHolidayController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const saloonHoliday_service_1 = require("./saloonHoliday.service");
const createSaloonHoliday = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield saloonHoliday_service_1.saloonHolidayService.createSaloonHolidayIntoDb(user.id, 
    // req.params.saloonId || req.body.saloonId,
    req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Saloon holiday created successfully',
        data: result,
    });
}));
const getSaloonHolidayList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield saloonHoliday_service_1.saloonHolidayService.getSaloonHolidayListFromDb(user.id, 
    // req.params.saloonId,
    {
        fromDate: req.query.fromDate ? new Date(req.query.fromDate) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate) : undefined,
        isRecurring: req.query.recurring ? req.query.recurring === 'true' : undefined
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon holidays retrieved successfully',
        data: result,
    });
}));
const getSaloonHolidayById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield saloonHoliday_service_1.saloonHolidayService.getSaloonHolidayByIdFromDb(user.id, req.params.holidayId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon holiday details retrieved successfully',
        data: result,
    });
}));
const updateSaloonHoliday = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield saloonHoliday_service_1.saloonHolidayService.updateSaloonHolidayIntoDb(user.id, req.params.holidayId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon holiday updated successfully',
        data: result,
    });
}));
const deleteSaloonHoliday = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield saloonHoliday_service_1.saloonHolidayService.deleteSaloonHolidayItemFromDb(user.id, req.params.holidayId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon holiday deleted successfully',
        data: result,
    });
}));
const checkSaloonHoliday = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield saloonHoliday_service_1.saloonHolidayService.checkSaloonHolidayFromDb(req.params.saloonId, req.query.date ? new Date(req.query.date) : new Date());
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Saloon holiday check completed',
        data: result,
    });
}));
exports.saloonHolidayController = {
    createSaloonHoliday,
    getSaloonHolidayList,
    getSaloonHolidayById,
    updateSaloonHoliday,
    deleteSaloonHoliday,
    checkSaloonHoliday
};
