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
exports.barberScheduleController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const barberSchedule_service_1 = require("./barberSchedule.service");
const client_1 = require("@prisma/client");
const createBarberSchedule = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const subscriptionPlanName = user.subscriptionPlan;
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.FREE ||
        subscriptionPlanName === client_1.SubscriptionPlanStatus.ADVANCED_PREMIUM) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.FORBIDDEN,
            success: false,
            message: 'Access denied. Upgrade your subscription to access to manage barber schedules.',
            data: null,
        });
    }
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.BASIC_PREMIUM ||
        client_1.SubscriptionPlanStatus.PRO_PREMIUM) {
        const result = yield barberSchedule_service_1.barberScheduleService.createBarberScheduleIntoDb(user.id, req.body);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.CREATED,
            success: true,
            message: 'BarberSchedule created successfully',
            data: result,
        });
    }
}));
const getBarberScheduleList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield barberSchedule_service_1.barberScheduleService.getBarberScheduleListFromDb(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'BarberSchedule list retrieved successfully',
        data: result,
    });
}));
const getBarberScheduleById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield barberSchedule_service_1.barberScheduleService.getBarberScheduleByIdFromDb(user.id, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'BarberSchedule details retrieved successfully',
        data: result,
    });
}));
const updateBarberSchedule = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const subscriptionPlanName = user.subscriptionPlan;
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.FREE ||
        subscriptionPlanName === client_1.SubscriptionPlanStatus.ADVANCED_PREMIUM) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.FORBIDDEN,
            success: false,
            message: 'Access denied. Upgrade your subscription to access to manage barber schedules.',
            data: null,
        });
    }
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.BASIC_PREMIUM ||
        client_1.SubscriptionPlanStatus.PRO_PREMIUM) {
        const result = yield barberSchedule_service_1.barberScheduleService.updateBarberScheduleIntoDb(user.id, req.params.id, req.body);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'BarberSchedule updated successfully',
            data: result,
        });
    }
}));
const deleteBarberSchedule = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const subscriptionPlanName = user.subscriptionPlan;
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.FREE ||
        subscriptionPlanName === client_1.SubscriptionPlanStatus.ADVANCED_PREMIUM) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.FORBIDDEN,
            success: false,
            message: 'Access denied. Upgrade your subscription to access to manage barber schedules.',
            data: null,
        });
    }
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.BASIC_PREMIUM ||
        client_1.SubscriptionPlanStatus.PRO_PREMIUM) {
        const result = yield barberSchedule_service_1.barberScheduleService.deleteBarberScheduleItemFromDb(user.id, req.params.id);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'BarberSchedule deleted successfully',
            data: result,
        });
    }
}));
exports.barberScheduleController = {
    createBarberSchedule,
    getBarberScheduleList,
    getBarberScheduleById,
    updateBarberSchedule,
    deleteBarberSchedule,
};
