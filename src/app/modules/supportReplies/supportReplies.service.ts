import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import emailSender from '../../utils/emailSender';
import { SupportStatus, SupportType } from '@prisma/client';

const createSupportRepliesIntoDb = async (userId: string, data: any) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      fullName: true,
    },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const result = await prisma.support.create({
    data: {
      ...data,
      userId: userId,
      userName: user?.fullName,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Support Item is not created');
  }
  return result;
};

const getSupportRepliesReportsFromDb = async () => {
  const result = await prisma.support.findMany({
    where: {
      type: SupportType.CUSTOMER_COMPLAINT,
    },
    select: {
      id: true,
      userId: true,
      userName: true,
      message: true,
      createdAt: true,
    },
  });
  if (result.length === 0) {
    return [];
  } 
  return result;
};

const getSupportRepliesListFromDb = async () => {
  const result = await prisma.support.findMany();
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getSupportRepliesByIdFromDb = async (supportRepliesId: string) => {
  const result = await prisma.support.update({
    where: {
      id: supportRepliesId,
    },
    data: {
      status: SupportStatus.IN_PROGRESS,
    },
  });
  if (!result) {
    return { message: 'Support item is not found' };
  }
  return result;
};

const updateSupportRepliesIntoDb = async (
  userId: string,
  supportRepliesId: string,
  data: any,
) => {
  const userData = await prisma.user.findUnique({
    where: {
      id: data.userId!,
    },
    include: {
      Support: {
        where: {
          id: supportRepliesId,
          userId: data.userId!,
        },
        select: {
          message: true,
        },
      },
    },
  });
  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  await emailSender(
    'Barbers Time - Support',
    userData.email!,

    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">${userData.Support[0]?.message ?? ''}</h2>
      </td>
    </tr>
    <tr>

      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${
          userData.fullName
        }</strong>,</p>
        <p style="font-size: 16px;">Hope your doing well.</p>
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 18px;" >${data.message!}</p>
        </div>
        <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
        <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Time Team. All rights reserved.</p>
      </td>
    </tr>
    </table>
  </div>

      `,
  );
  const result = await prisma.support.update({
    where: {
      id: supportRepliesId,
    },
    data: {
      status: SupportStatus.CLOSED,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Support Item is not updated');
  }
  return result;
};

const deleteSupportRepliesItemFromDb = async (
  userId: string,
  supportRepliesId: string,
) => {
  const deletedItem = await prisma.support.delete({
    where: {
      id: supportRepliesId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'supportRepliesId is not deleted',
    );
  }

  return deletedItem;
};

export const supportRepliesService = {
  createSupportRepliesIntoDb,
  getSupportRepliesListFromDb,
  getSupportRepliesByIdFromDb,
  updateSupportRepliesIntoDb,
  deleteSupportRepliesItemFromDb,
  getSupportRepliesReportsFromDb,
};
