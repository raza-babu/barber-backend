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
exports.barberLunchController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const barberLunch_service_1 = require("./barberLunch.service");
const client_1 = require("@prisma/client");
const createBarberLunch = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const subscriptionPlanName = user.subscriptionPlan;
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.FREE ||
        subscriptionPlanName === client_1.SubscriptionPlanStatus.ADVANCED_PREMIUM) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.FORBIDDEN,
            success: false,
            message: 'Access denied. Upgrade your subscription to access to manage barber lunch times.',
            data: null,
        });
    }
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.BASIC_PREMIUM ||
        client_1.SubscriptionPlanStatus.PRO_PREMIUM) {
        const result = yield barberLunch_service_1.barberLunchService.createBarberLunchIntoDb(user.id, req.body);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.CREATED,
            success: true,
            message: 'BarberLunch created successfully',
            data: result,
        });
    }
}));
const getBarberLunchList = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const subscriptionPlanName = user.subscriptionPlan;
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.FREE ||
        subscriptionPlanName === client_1.SubscriptionPlanStatus.ADVANCED_PREMIUM) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.FORBIDDEN,
            success: false,
            message: 'Access denied. Upgrade your subscription to access to manage barber lunch times.',
            data: null,
        });
    }
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.BASIC_PREMIUM ||
        client_1.SubscriptionPlanStatus.PRO_PREMIUM) {
        const result = yield barberLunch_service_1.barberLunchService.getBarberLunchListFromDb(user.id);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'BarberLunch list retrieved successfully',
            data: result,
        });
    }
}));
const getBarberLunchById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const subscriptionPlanName = user.subscriptionPlan;
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.FREE ||
        subscriptionPlanName === client_1.SubscriptionPlanStatus.ADVANCED_PREMIUM) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.FORBIDDEN,
            success: false,
            message: 'Access denied. Upgrade your subscription to access to manage barber holidays.',
            data: null,
        });
    }
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.BASIC_PREMIUM ||
        client_1.SubscriptionPlanStatus.PRO_PREMIUM) {
        const result = yield barberLunch_service_1.barberLunchService.getBarberLunchByIdFromDb(user.id, req.params.id);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'BarberLunch details retrieved successfully',
            data: result,
        });
    }
}));
const updateBarberLunch = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const subscriptionPlanName = user.subscriptionPlan;
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.FREE ||
        subscriptionPlanName === client_1.SubscriptionPlanStatus.ADVANCED_PREMIUM) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.FORBIDDEN,
            success: false,
            message: 'Access denied. Upgrade your subscription to access to manage barber lunch times.',
            data: null,
        });
    }
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.BASIC_PREMIUM ||
        client_1.SubscriptionPlanStatus.PRO_PREMIUM) {
        const result = yield barberLunch_service_1.barberLunchService.updateBarberLunchIntoDb(user.id, req.params.id, req.body);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'BarberLunch updated successfully',
            data: result,
        });
    }
}));
const deleteBarberLunch = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const subscriptionPlanName = user.subscriptionPlan;
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.FREE ||
        subscriptionPlanName === client_1.SubscriptionPlanStatus.ADVANCED_PREMIUM) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.FORBIDDEN,
            success: false,
            message: 'Access denied. Upgrade your subscription to access to manage barber lunch times.',
            data: null,
        });
    }
    if (subscriptionPlanName === client_1.SubscriptionPlanStatus.BASIC_PREMIUM ||
        client_1.SubscriptionPlanStatus.PRO_PREMIUM) {
        const result = yield barberLunch_service_1.barberLunchService.deleteBarberLunchItemFromDb(user.id, req.params.id);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'BarberLunch deleted successfully',
            data: result,
        });
    }
}));
exports.barberLunchController = {
    createBarberLunch,
    getBarberLunchList,
    getBarberLunchById,
    updateBarberLunch,
    deleteBarberLunch,
};
