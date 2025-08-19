"use strict";
// Notification.service: Module file for the Notification.service functionality.
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
exports.notificationService = void 0;
const firebase_1 = __importDefault(require("../../utils/firebase"));
const prisma_1 = __importDefault(require("../../utils/prisma"));
const sendNotification = (deviceToken, title, body, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const message = {
        notification: { title, body },
        token: deviceToken,
    };
    console.log(message);
    try {
        yield firebase_1.default.messaging().send(message);
        yield prisma_1.default.notification.create({
            data: {
                title,
                body,
                userId,
            },
        });
        console.log('Notification sent successfully');
    }
    catch (error) {
        console.error('Error sending notification:', error);
        throw error;
    }
});
const getAllNotifications = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const notifications = yield prisma_1.default.notification.findMany();
        return notifications;
    }
    catch (error) {
        console.error('Error fetching notifications:', error);
        throw error;
    }
});
const getNotificationByUserId = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const notifications = yield prisma_1.default.notification.findMany({
            where: { userId },
        });
        return notifications;
    }
    catch (error) {
        console.error('Error fetching notifications by user ID:', error);
        throw error;
    }
});
const readNotificationByUserId = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const notifications = yield prisma_1.default.notification.updateMany({
            where: { userId, read: false },
            data: { read: true },
        });
        return notifications;
    }
    catch (error) {
        console.error('Error marking notifications as read:', error);
        throw error;
    }
});
const sendNotificationToGroupIntoDb = (userId, notificationData) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, body, users } = notificationData;
    const notifications = users.map((user) => __awaiter(void 0, void 0, void 0, function* () {
        const fcmToken = yield prisma_1.default.user.findUnique({
            where: { id: user },
            select: { fcmToken: true },
        });
        if (fcmToken === null || fcmToken === void 0 ? void 0 : fcmToken.fcmToken) {
            const message = {
                notification: { title, body },
                token: fcmToken.fcmToken,
            };
            yield firebase_1.default.messaging().send(message);
        }
        const notifications = yield prisma_1.default.notification.create({
            data: {
                title,
                body,
                userId: user,
            },
        });
    }));
    yield Promise.all(notifications);
    return notifications;
});
exports.notificationService = {
    sendNotification,
    getAllNotifications,
    getNotificationByUserId,
    readNotificationByUserId,
    sendNotificationToGroupIntoDb,
};
