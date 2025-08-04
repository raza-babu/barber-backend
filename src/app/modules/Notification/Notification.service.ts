// Notification.service: Module file for the Notification.service functionality.

import admin from '../../utils/firebase';
import prisma from '../../utils/prisma';

const sendNotification = async (
  deviceToken: string,
  title: string,
  body: string,
  userId: string,
) => {
  const message = {
    notification: { title, body },
    token: deviceToken,
  };

  console.log(message);

  try {
    await admin.messaging().send(message);

    await prisma.notification.create({
      data: {
        title,
        body,
        userId,
      },
    });
    console.log('Notification sent successfully');
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

const getAllNotifications = async () => {
  try {
    const notifications = await prisma.notification.findMany();
    return notifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

const getNotificationByUserId = async (userId: string) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
    });
    return notifications;
  } catch (error) {
    console.error('Error fetching notifications by user ID:', error);
    throw error;
  }
};

const readNotificationByUserId = async (userId: string) => {
  try {
    const notifications = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return notifications;
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
};

const sendNotificationToGroupIntoDb = async (userId: string, notificationData: { 
  title: string,
  body: string,
  users: string[] 
  }) => {
  const { title, body, users } = notificationData;

  const notifications = users.map(async (user) => {
   const fcmToken = await prisma.user.findUnique({
     where: { id: user },
     select: { fcmToken: true },
   });

   if (fcmToken?.fcmToken) {
     const message = {
       notification: { title, body },
       token: fcmToken.fcmToken,
     };

     await admin.messaging().send(message);
   }

   const notifications = await prisma.notification.create({
    data: {
      title,
      body,
      userId: user,
    },
   });
  });

  await Promise.all(notifications);


  return notifications;
};

export const notificationService = {
  sendNotification,
  getAllNotifications,
  getNotificationByUserId,
  readNotificationByUserId,
  sendNotificationToGroupIntoDb,
};
