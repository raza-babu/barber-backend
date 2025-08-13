"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRoutes = void 0;
// Notification.routes: Module file for the Notification.routes functionality.
const express_1 = __importDefault(require("express"));
const Notification_controller_1 = require("./Notification.controller");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
router.post('/send', Notification_controller_1.NotificationController.sendNotificationToUser);
router.post('/send-group', (0, auth_1.default)(client_1.UserRoleEnum.ADMIN, client_1.UserRoleEnum.SUPER_ADMIN), Notification_controller_1.NotificationController.sendNotificationToUserGroup);
// Get all notifications
router.get('/', (0, auth_1.default)(), Notification_controller_1.NotificationController.getAllNotificationsController);
// Get notifications by user ID
router.get('/get', (0, auth_1.default)(), Notification_controller_1.NotificationController.getNotificationByUserIdController);
// Mark notifications as read by user ID
router.patch('/read', (0, auth_1.default)(), Notification_controller_1.NotificationController.readNotificationByUserIdController);
exports.NotificationRoutes = router;
