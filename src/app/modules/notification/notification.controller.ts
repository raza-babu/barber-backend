// Notification.controller: Module file for the Notification.controller functionality.
import { notificationService } from './notification.service';
import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const sendNotificationToUser = catchAsync(async (req, res) => {
  const { deviceToken, title, body, userId } = req.body;

  if (!title || !body || !userId) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Title, body, and user ID are required',
    });
  }

  const result =  await notificationService.sendNotification(deviceToken, title, body, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notification sent successfully',
    data: result,
  });
});

const getAllNotificationsController = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const notifications = await notificationService.getAllNotifications(
    user.id,
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All notifications fetched successfully',
    data: notifications.data,
    meta: notifications.meta,
  });
});

const getNotificationByUserIdController = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const notifications = await notificationService.getNotificationByUserId(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notifications fetched successfully',
    data: notifications,
  });
});

const readNotificationByUserIdController = catchAsync(async (req: Request, res: Response) => {
  const  userId  = req.user?.id;
  const notifications = await notificationService.readNotificationByUserId(userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notifications marked as read successfully',
    data: notifications,
  });
});

const readANotificationByUserIdController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const notificationId = req.params.id;
  const notification = await notificationService.readANotificationByUserId(userId, notificationId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notification marked as read successfully',
    data: notification,
  });
});

const deleteNotificationByUserIdController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const result = await notificationService.deleteNotificationByUserId(userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notifications deleted successfully',
    data: result,
  });
});

const deleteANotificationByUserIdController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const notificationId = req.params.id;
  const result = await notificationService.deleteANotificationByUserId(userId, notificationId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notification deleted successfully',
    data: result,
  });
});

const sendNotificationToUserGroup = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await notificationService.sendNotificationToGroupIntoDb(user.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notification sent successfully',
    data: result,
  });
});

export const NotificationController = {
  sendNotificationToUser,
  getAllNotificationsController,
  getNotificationByUserIdController,
  readNotificationByUserIdController,
  readANotificationByUserIdController,
  sendNotificationToUserGroup,
  deleteNotificationByUserIdController,
  deleteANotificationByUserIdController,
};
