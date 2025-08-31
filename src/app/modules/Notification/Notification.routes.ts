import express from 'express';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';
import { NotificationController } from './Notification.controller';

const router = express.Router();

router.post('/send', NotificationController.sendNotificationToUser);


router.post(
    '/send-group',
    auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN),
    NotificationController.sendNotificationToUserGroup,
)


// Get all notifications
router.get('/',auth(), NotificationController.getAllNotificationsController);

// Get notifications by user ID
router.get('/get',auth(), NotificationController.getNotificationByUserIdController);

// Mark notifications as read by user ID
router.patch('/read',auth(), NotificationController.readNotificationByUserIdController);
export const NotificationRoutes = router;