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
exports.NotificationController = void 0;
// Notification.controller: Module file for the Notification.controller functionality.
const Notification_service_1 = require("./Notification.service");
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const sendNotificationToUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { deviceToken, title, body, userId } = req.body;
    if (!deviceToken || !title || !body || !userId) {
        return res.status(http_status_1.default.BAD_REQUEST).json({
            success: false,
            message: 'Device token, title, and body are required',
        });
    }
    yield Notification_service_1.notificationService.sendNotification(deviceToken, title, body, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Notification sent successfully',
        data: null,
    });
}));
const getAllNotificationsController = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const notifications = yield Notification_service_1.notificationService.getAllNotifications();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'All notifications fetched successfully',
        data: notifications,
    });
}));
const getNotificationByUserIdController = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const notifications = yield Notification_service_1.notificationService.getNotificationByUserId(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Notifications fetched successfully',
        data: notifications,
    });
}));
const readNotificationByUserIdController = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const notifications = yield Notification_service_1.notificationService.readNotificationByUserId(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Notifications marked as read successfully',
        data: notifications,
    });
}));
const sendNotificationToUserGroup = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield Notification_service_1.notificationService.sendNotificationToGroupIntoDb(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Notification sent successfully',
        data: result,
    });
}));
exports.NotificationController = {
    sendNotificationToUser,
    getAllNotificationsController,
    getNotificationByUserIdController,
    readNotificationByUserIdController,
    sendNotificationToUserGroup,
};
