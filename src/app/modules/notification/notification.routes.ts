// Notification.routes: Module file for the Notification.routes functionality.
import express from 'express';
import { NotificationController } from './notification.controller';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post('/send', NotificationController.sendNotificationToUser);

router.post(
  '/send-group',
  auth(),
  NotificationController.sendNotificationToUserGroup,
);

// Get all notifications
router.get('/', auth(), NotificationController.getAllNotificationsController);

// Get notifications by user ID
router.get(
  '/get',
  auth(),
  NotificationController.getNotificationByUserIdController,
);

// Mark notifications as read by user ID
router.patch(
  '/read',
  auth(),
  NotificationController.readNotificationByUserIdController,
);

router.patch(
  '/read/:id',
  auth(),
  NotificationController.readANotificationByUserIdController,
);

router.delete(
  '/clear-all',
  auth(),
  NotificationController.deleteNotificationByUserIdController,
);

router.delete(
  '/clear/:id',
  auth(),
  NotificationController.deleteANotificationByUserIdController,
);

export const NotificationRoutes = router;
