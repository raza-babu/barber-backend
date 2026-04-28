import { User, UserStatus, UserRoleEnum } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../../config';
import AppError from '../../errors/AppError';
import emailSender from '../../utils/emailSender';
import { generateToken, refreshToken } from '../../utils/generateToken';
import prisma from '../../utils/prisma';
import { notificationService } from '../notification/notification.service';
import { SubscriptionPlanStatus } from '@prisma/client';
import Stripe from 'stripe';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Type } from '@aws-sdk/client-s3';
import { deleteFileFromSpace } from '../../utils/deleteImage';
import { TUpdateSaloonOwnerStatusTypePayload } from './user.validation';

// Initialize Stripe with your secret API key
const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});

interface UserWithOptionalPassword extends Omit<User, 'password'> {
  password?: string;
}

const registerUserIntoDB = async (payload: any) => {
  if (payload.email) {
    const existingUser = await prisma.user.findUnique({
      where: {
        email: payload.email,
      },
    });
    if (existingUser) {
      if (existingUser.isVerified === false) {
        // send OTP email inside transaction so failures roll back DB changes
        // return login;
        const otp = Math.floor(1000 + Math.random() * 9000);
        const otpExpiresAt = new Date();
        otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);
        const otpExpiresAtString = otpExpiresAt.toISOString();
        await prisma.user.update({
          where: { email: payload.email },
          data: {
            otp: otp,
            otpExpiry: otpExpiresAtString,
          },
        });
        await emailSender(
          'Verify Your Email',
          existingUser.email,
          `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Verify your email</h2>
      </td>
    </tr>
    <tr>

      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${existingUser.fullName}</strong>,</p>
        <p style="font-size: 16px;">Please verify your email.</p>
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 18px;" >Verify email using this OTP: <span style="font-weight:bold"> ${otp} </span><br/> This OTP will be Expired in 5 minutes,</p>
        </div>
        <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
        <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Team. All rights reserved.</p>
      </td>
    </tr>
    </table>
  </div>
        `,
        );
        return { message: 'OTP sent via your email successfully' };
      }
      throw new AppError(httpStatus.CONFLICT, 'User already exists!');
    }
  }

  const hashedPassword: string = await bcrypt.hash(payload.password, 12);

  const userData = {
    ...payload,
    password: hashedPassword,
    intendedRole: payload.intendedRole
      ? payload.intendedRole
      : UserRoleEnum.CUSTOMER,
    phoneNumber: payload.phoneNumber || undefined,
  };

  const result = await prisma.$transaction(async (transactionClient: any) => {
    const user = await transactionClient.user.create({
      data: userData,
    });
    if (!user) {
      throw new AppError(httpStatus.BAD_REQUEST, 'User not created!');
    }
  });

  // return login;
  const otp = Math.floor(1000 + Math.random() * 9000);
  const otpExpiresAt = new Date();
  otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);
  const otpExpiresAtString = otpExpiresAt.toISOString();

  await prisma.user.update({
    where: { email: payload.email },
    data: {
      otp: otp,
      otpExpiry: otpExpiresAtString,
    },
  });

  await emailSender(
    'Verify Your Email',
    userData.email!,

    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Verify your email</h2>
      </td>
    </tr>
    <tr>

      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${
          userData.fullName
        }</strong>,</p>
        <p style="font-size: 16px;">Please verify your email.</p>
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 18px;" >Verify email using this OTP: <span style="font-weight:bold"> ${otp} </span><br/> This OTP will be Expired in 5 minutes,</p>
        </div>
        <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
        <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Team. All rights reserved.</p>
      </td>
    </tr>
    </table>
  </div>

      `,
  );

  // Send notification to user about registration
  try {
    const registeredUser = await prisma.user.findUnique({
      where: { email: payload.email },
      select: { id: true, fcmToken: true, fullName: true },
    });

    if (registeredUser?.fcmToken) {
      const message = `Welcome to Barbers Time, ${registeredUser.fullName}! Please verify your email with the OTP sent.`;

      await notificationService
        .sendNotification(
          registeredUser.fcmToken,
          'Verify Your Email',
          message,
          registeredUser.id,
        )
        .catch(error =>
          console.error('Error sending registration notification:', error),
        );
    }
  } catch (error) {
    console.error('Error sending registration notification:', error);
  }

  return { message: 'OTP sent via your email successfully' };
};

//resend verification email
const resendUserVerificationEmail = async (email: string) => {
  const userData = await prisma.user.findUnique({
    where: { email: email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }
  const otp = Math.floor(1000 + Math.random() * 9000);
  const otpExpiresAt = new Date();
  otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);
  const otpExpiresAtString = otpExpiresAt.toISOString();

  await prisma.user.update({
    where: { email: email },
    data: {
      otp: otp,
      otpExpiry: otpExpiresAtString,
    },
  });
  if (!userData.email) {
    throw new AppError(httpStatus.CONFLICT, 'Email not set for this user');
  }

  await emailSender(
    'Verify Your Email',
    userData.email,

    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #000000; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #f5f5f5; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Verify Your Email</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${
          userData.fullName
        }</strong>,</p>
        <p style="font-size: 16px;">Please verify your email.</p>
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 18px;" >Verify email using this OTP: <span style="font-weight:bold"> ${otp} </span><br/> This OTP will be Expired in 5 minutes,</p>
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

  return { message: 'OTP sent via your email successfully' };
};

const registerSaloonOwnerIntoDB = async (payload: any) => {
  const { email } = payload;
  let userId;

  if (email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    userId = existingUser?.id;

    if (!existingUser) {
      throw new AppError(httpStatus.CONFLICT, 'User not exists!');
    }

    const existingSaloonOwner = await prisma.saloonOwner.findUnique({
      where: { userId: existingUser.id },
    });

    if (existingSaloonOwner) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Saloon owner already exists for this user!',
      );
    }

    const result = await prisma.$transaction(async tx => {
      // Exclude 'email' from payload before creating saloon owner
      const { email, ...saloonOwnerData } = payload;
      const createdSaloonOwner = await tx.saloonOwner.create({
        data: {
          ...saloonOwnerData,
          userId: userId!,
        },
      });
      const updatedUser = await tx.user.update({
        where: { email, intendedRole: UserRoleEnum.SALOON_OWNER },
        data: {
          role: UserRoleEnum.SALOON_OWNER,
          intendedRole: null,
          isProfileComplete: true,
        },
      });

      if (!updatedUser) {
        throw new AppError(httpStatus.BAD_REQUEST, 'User role not updated!');
      }

      if (!createdSaloonOwner) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Saloon shop not created!');
      }

      return createdSaloonOwner;
    });

    return result;
  }

  throw new AppError(httpStatus.BAD_REQUEST, 'Email is required!');
};

const updateSaloonOwnerIntoDB = async (userId: string, payload: any) => {
  if (userId) {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new AppError(httpStatus.CONFLICT, 'User not exists!');
    }

    const existingSaloonOwner = await prisma.saloonOwner.findUnique({
      where: { userId: existingUser.id },
    });

    if (!existingSaloonOwner) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Saloon owner does not exist for this user!',
      );
    }

    const result = await prisma.$transaction(async tx => {
      // delete removed shop images from aws s3 space
      const currentSaloonOwner = await tx.saloonOwner.findUnique({
        where: { userId: existingUser.id },
        select: { shopImages: true, shopVideo: true },
      });
      const currentImages = currentSaloonOwner?.shopImages || [];
      const newImages = payload.shopImages || [];
      const removedImages = currentImages.filter(
        (img: string) => !newImages.includes(img),
      );
      const currentVideos = currentSaloonOwner?.shopVideo || [];
      const newVideos = payload.shopVideos || [];
      const removedVideos = currentVideos.filter(
        (vid: string) => !newVideos.includes(vid),
      );
      for (const img of removedImages) {
        await deleteFileFromSpace(img).catch(error =>
          console.error('Error deleting old shop image from S3:', error),
        );
      }
      for (const vid of removedVideos) {
        await deleteFileFromSpace(vid).catch(error =>
          console.error('Error deleting old shop video from S3:', error),
        );
      }

      const updatedSaloonOwner = await tx.saloonOwner.update({
        where: { userId: existingUser.id },
        data: payload,
      });

      if (!updatedSaloonOwner) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Saloon shop not updated!');
      }

      return updatedSaloonOwner;
    });

    return result;
  }

  throw new AppError(httpStatus.BAD_REQUEST, 'Email is required!');
};

const updateBarberIntoDB = async (userId: string, payload: any) => {
  let existingUser: User | null;
  if (userId) {
    existingUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!existingUser) {
      throw new AppError(httpStatus.CONFLICT, 'User not exists!');
    }

    const existingBarber = await prisma.barber.findUnique({
      where: {
        userId: existingUser.id,
      },
    });
    if (!existingBarber) {
      const barber = await prisma.barber.create({
        data: {
          userId: existingUser.id,
        },
      });
      if (!barber) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Barber is not created!');
      }
    }
  }

  // delete removed reference images from aws s3 space
  const currentBarber = await prisma.barber.findUnique({
    where: { userId: existingUser!.id },
    select: { portfolio: true },
  });
  const currentImages = currentBarber?.portfolio || [];
  const newImages = payload.portfolio || [];
  const removedImages = currentImages.filter(
    (img: string) => !newImages.includes(img),
  );

  // Delete removed images from S3
  for (const img of removedImages) {
    await deleteFileFromSpace(img).catch(error =>
      console.error('Error deleting old reference image from S3:', error),
    );
  }

  const result = await prisma.$transaction(async (transactionClient: any) => {
    // const updateUserRole = await transactionClient.user.update({
    //   where: { email: payload.email, intendedRole: UserRoleEnum.BARBER },
    //   data: {
    //     role: UserRoleEnum.BARBER,
    //     intendedRole: null,
    //     isProfileComplete: true,
    //   },
    // });
    // if (!updateUserRole) {
    //   throw new AppError(httpStatus.BAD_REQUEST, 'User role not updated!');
    // }

    const user = await transactionClient.barber.update({
      where: { userId: existingUser!.id },
      data: payload,
    });
    if (!user) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Barber is not created!');
    }
  });
  // Fetch and return the updated barber details including related user info
  const updatedBarber = await prisma.barber.findUnique({
    where: { userId: existingUser!.id },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          role: true,
          isProfileComplete: true,
        },
      },
    },
  });

  return updatedBarber;
};

const sendReferenceImagesToAI = async (
  userId: string,
  images: Express.Multer.File[],
) => {
  if (!userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'userId is required');
  }
  if (!images || images.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'At least one image is required',
    );
  }

  const form = new FormData();
  form.append('barber_code', userId);

  const filesToCleanup: string[] = [];

  try {
    // Accept multer files (disk or memory storage). Support both buffer and path.
    for (let i = 0; i < images.length; i++) {
      const file = images[i] as Express.Multer.File;

      if (!file) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Invalid file at index ${i}`,
        );
      }

      // If using memoryStorage, multer provides a buffer
      if (file.buffer && file.buffer.length > 0) {
        form.append('images', file.buffer, {
          filename: file.originalname || `image_${i}.jpg`,
          contentType: file.mimetype || 'image/jpeg',
        });
        console.log(
          `Added buffer file ${i}:`,
          file.originalname,
          `(${file.buffer.length} bytes)`,
        );
        continue;
      }

      // If using diskStorage, multer provides a path
      if (file.path) {
        const resolvedPath = path.isAbsolute(file.path)
          ? file.path
          : path.resolve(process.cwd(), file.path);

        if (!fs.existsSync(resolvedPath)) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            `Uploaded file not found at index ${i}: ${resolvedPath}`,
          );
        }

        filesToCleanup.push(resolvedPath);

        // Read file as buffer instead of stream for better reliability
        const fileBuffer = fs.readFileSync(resolvedPath);
        form.append('images', fileBuffer, {
          filename: file.originalname || path.basename(resolvedPath),
          contentType: file.mimetype || 'image/jpeg',
        });
        console.log(
          `Added file ${i}:`,
          file.originalname,
          `(${fileBuffer.length} bytes)`,
        );
        continue;
      }

      // Neither buffer nor path available — unsupported multer configuration
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Unsupported multer file at index ${i}. Ensure you use diskStorage or memoryStorage.`,
      );
    }

    // Delete previous images from AI service before uploading new ones
    try {
      const deleteUrl = `http://13.48.206.147:8000/delete_barber/${userId}`;
      console.log('=== Deleting Previous Images ===');
      console.log('Delete URL:', deleteUrl);

      const deleteResp = await axios.delete(deleteUrl, {
        timeout: 30000,
        validateStatus: status => status < 500,
      });

      // console.log('Delete Response Status:', deleteResp.status);
      // console.log('Delete Response:', JSON.stringify(deleteResp.data, null, 2));

      if (deleteResp.status >= 400) {
        console.warn(
          `⚠️ Warning: Failed to delete previous images (status: ${deleteResp.status}). Proceeding with upload anyway.`,
        );
      } else {
        console.log(
          `✅ Successfully deleted previous images for barber ${userId}`,
        );
      }
    } catch (deleteErr: any) {
      console.warn(
        '⚠️ Warning: Error deleting previous images:',
        deleteErr.message,
      );
      console.log('Proceeding with upload despite deletion error.');
    }

    const url = 'http://13.48.206.147:8000/upload_reference';

    // Get form-data headers (includes Content-Type with boundary)
    const headers = {
      ...form.getHeaders(),
    };

    console.log('=== AI Upload Request ===');
    console.log('URL:', url);
    console.log('Headers:', headers);
    console.log('Barber Code:', userId);
    console.log('Number of images:', images.length);
    console.log(
      'Form data size:',
      form.getLengthSync ? form.getLengthSync() : 'unknown',
    );

    const resp = await axios.post(url, form, {
      headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000, // Increased to 120 seconds
      validateStatus: status => status < 500,
    });

    console.log('=== AI Upload Response ===');
    console.log('Status:', resp.status);
    console.log('Response data:', JSON.stringify(resp.data, null, 2));

    // Handle non-success status codes
    if (resp.status === 400) {
      const errorMessage =
        resp.data?.message || resp.data?.error || 'Bad request to AI service';
      console.error('400 Error details:', resp.data);
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `AI service error: ${errorMessage}`,
      );
    }

    if (resp.status === 401 || resp.status === 403) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'Authentication failed with AI service',
      );
    }

    if (resp.status === 404) {
      throw new AppError(httpStatus.NOT_FOUND, 'AI upload endpoint not found');
    }

    if (resp.status >= 400) {
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        `AI service returned error: ${resp.status}`,
      );
    }

    // Verify the upload was successful
    if (resp.data && resp.data.success) {
      console.log(
        `✅ Successfully uploaded ${resp.data.total_images} images for barber ${userId}`,
      );

      // Optional: Verify the upload by calling the GET API
      try {
        const verifyResp = await axios.get(
          'http://13.48.206.147:8000/get_barbers',
          {
            timeout: 10000,
          },
        );
        console.log('=== Verification Check ===');
        const barberData = verifyResp.data?.barbers?.find(
          (b: any) => b.barber_code === userId,
        );
        if (barberData) {
          console.log(
            `✅ Barber ${userId} found in get_barbers with ${barberData.reference_images?.length || 0} images`,
          );
        } else {
          console.log(
            `⚠️ Barber ${userId} not found in get_barbers yet (might take a moment to sync)`,
          );
        }
      } catch (verifyErr) {
        console.error('Verification check failed:', verifyErr);
      }
    }

    console.log(`AI service response for barberId ${userId}:`, resp.data);
    return resp.data;
  } catch (err: any) {
    console.error('=== AI Upload Error ===');
    console.error('Error type:', err.constructor.name);
    console.error('Error message:', err.message);

    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
      console.error('Response headers:', err.response.headers);
    }

    if (err.request) {
      console.error('Request was made but no response received');
    }

    if (err instanceof AppError) {
      throw err;
    }

    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      'Unknown error';
    throw new AppError(httpStatus.BAD_GATEWAY, `AI service error: ${message}`);
  } finally {
    // Clean up temporary files if using disk storage
    for (const filePath of filesToCleanup) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up temp file: ${filePath}`);
        }
      } catch (cleanupErr) {
        console.error(`Failed to cleanup file ${filePath}:`, cleanupErr);
      }
    }
  }
};

const getMyProfileFromDB = async (id: string) => {
  const Profile = await prisma.user.findUnique({
    where: {
      id: id,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      dateOfBirth: true,
      phoneNumber: true,
      address: true,
      followerCount: true,
      followingCount: true,
      image: true,
      gender: true,
      stripeAccountId: true,
      subscriptionPlan: true,
      subscriptionEnd: true,
      isSubscribed: true,
      onBoarding: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Profile;
};

const getSaloonOwnerProfileFromDB = async (userId: string) => {
  const profile = await prisma.saloonOwner.findUnique({
    where: {
      userId: userId,
    },
    include: {
      user: {
        select: {
          id: true,
          followerCount: true,
          followingCount: true,
        },
      },
    },
  });
  if (!profile) {
    throw new AppError(httpStatus.NOT_FOUND, 'Saloon owner profile not found');
  }

  // get the hired barbers for the saloon owner
  const hiredBarbers = await prisma.barber.findMany({
    where: {
      saloonOwnerId: profile.userId,
    },
    select: {
      user: {
        select: {
          id: true,
          fullName: true,
          image: true,
          email: true,
        },
      },
      BarberSchedule: {
        select: {
          id: true,
          dayName: true,
          openingTime: true,
          closingTime: true,
          type: true,
          isActive: true,
        },
      },
    },
  });

  // services offered by saloon owner
  const services = await prisma.service.findMany({
    where: {
      saloonOwnerId: profile.userId,
    },
    select: {
      id: true,
      serviceName: true,
    },
  });
  const { user, ...restProfile } = profile;

  return {
    ...restProfile,
    isMe: profile?.userId === userId,
    followingCount: profile.user?.followingCount ?? 0,
    followerCount: profile.user?.followerCount ?? 0,
    Barbers: hiredBarbers.map(barber => ({
      id: barber.user?.id,
      fullName: barber.user?.fullName ?? null,
      email: barber.user?.email ?? null,
      image: barber.user?.image ?? null,
      hasSchedule: (barber.BarberSchedule ?? []).length > 0,
      scheduleCount: (barber.BarberSchedule ?? []).length,
      schedules: barber.BarberSchedule ?? [],
    })),
    services: services,
  };
};

const getBarberProfileFromDB = async (userId: string) => {
  const profile = await prisma.barber.findUnique({
    where: {
      userId: userId,
    },
    include: {
      user: {
        select: {
          id: true,
          followerCount: true,
          followingCount: true,
          image: true,
        },
      },
    },
  });
  const { user, ...restProfile } = profile!;
  return {
    isMe: profile?.userId === userId,
    ...restProfile,
    image: profile?.user?.image ?? null,
    followingCount: profile?.user?.followingCount ?? 0,
    followerCount: profile?.user?.followerCount ?? 0,
  };
};

const updateMyProfileIntoDB = async (id: string, payload: any) => {
  const userData = payload;

  if (userData.isQueueEnabled) {
    return {
      message:
        'Queue feature is available for Premium plan users. Please upgrade your plan to access this feature.',
    };
  }

  // update user data
  await prisma.$transaction(async (transactionClient: any) => {
    // Update user data
    const updatedUser = await transactionClient.user.update({
      where: { id },
      data: userData,
    });

    return { updatedUser };
  });

  // Fetch and return the updated user
  const updatedUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      dateOfBirth: true,
      phoneNumber: true,
      gender: true,
    },
  });
  if (!updatedUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User not updated!');
  }

  // const userWithOptionalPassword = updatedUser as UserWithOptionalPassword;
  // delete userWithOptionalPassword.password;

  return updatedUser;
};

const updateUserRoleStatusIntoDB = async (id: string, payload: any) => {
  const result = await prisma.user.update({
    where: {
      id: id,
    },
    data: payload,
  });
  return result;
};

const changePassword = async (
  user: any,
  userId: string,
  payload: {
    oldPassword: string;
    newPassword: string;
  },
) => {
  const userData = await prisma.user.findUnique({
    where: {
      id: userId,
      email: user.email,
      status: UserStatus.ACTIVE,
    },
  });
  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (userData.password === null) {
    throw new AppError(httpStatus.CONFLICT, 'Password not set for this user');
  }

  const isCorrectPassword: boolean = await bcrypt.compare(
    payload.oldPassword,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new Error('Password incorrect!');
  }

  const newPasswordSameAsOld: boolean = await bcrypt.compare(
    payload.newPassword,
    userData.password,
  );

  if (newPasswordSameAsOld) {
    throw new AppError(
      httpStatus.CONFLICT,
      'New password must be different from the old password',
    );
  }

  const hashedPassword: string = await bcrypt.hash(payload.newPassword, 12);

  await prisma.user.update({
    where: {
      id: userData.id,
    },
    data: {
      password: hashedPassword,
    },
  });

  return {
    message: 'Password changed successfully!',
  };
};

const forgotPassword = async (payload: { email: string }) => {
  const userData = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (!userData) {
    throw new AppError(httpStatus.CONFLICT, 'User not found!');
  }

  const otp = Math.floor(1000 + Math.random() * 9000);
  const otpExpiresAt = new Date();
  otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);
  const otpExpiresAtString = otpExpiresAt.toISOString();

  await prisma.user.update({
    where: { email: payload.email },
    data: {
      otp: otp,
      otpExpiry: otpExpiresAtString,
    },
  });
  if (!userData.email) {
    throw new AppError(httpStatus.CONFLICT, 'Email not set for this user');
  }

  await emailSender(
    'Verify Your Email',
    userData.email,

    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Reset password OTP</h2>
      </td>
    </tr>
    <tr>

      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${
          userData.fullName
        }</strong>,</p>
        <p style="font-size: 16px;">Please verify your email.</p>
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 18px;" >Verify email using this OTP: <span style="font-weight:bold"> ${otp} </span><br/> This OTP will be Expired in 5 minutes,</p>
        </div>
        <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
        <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Team. All rights reserved.</p>
      </td>
    </tr>
    </table>
  </div>

      `,
  );

  return { message: 'OTP sent via your email successfully' };
};

//resend otp
const resendOtpIntoDB = async (payload: any) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }
  const otp = Math.floor(1000 + Math.random() * 9000);
  const otpExpiresAt = new Date();
  otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);
  const otpExpiresAtString = otpExpiresAt.toISOString();

  await prisma.user.update({
    where: { email: payload.email },
    data: {
      otp: otp,
      otpExpiry: otpExpiresAtString,
    },
  });
  if (!userData.email) {
    throw new AppError(httpStatus.CONFLICT, 'Email not set for this user');
  }

  await emailSender(
    'Verify Your Email',
    userData.email,

    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #000000; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #f5f5f5; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Reset Password OTP</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${
          userData.fullName
        }</strong>,</p>
        <p style="font-size: 16px;">Please verify your email.</p>
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 18px;" >Verify email using this OTP: <span style="font-weight:bold"> ${otp} </span><br/> This OTP will be Expired in 5 minutes,</p>
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

  return { message: 'OTP sent via your email successfully' };
};
// verify otp
const verifyOtpInDB = async (bodyData: {
  email: string;
  password: string;
  otp: number;
}) => {
  const userData = await prisma.user.findUnique({
    where: { email: bodyData.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.CONFLICT, 'User not found!');
  }

  const currentTime = new Date();

  if (userData.otp !== bodyData.otp) {
    throw new AppError(httpStatus.CONFLICT, 'Your OTP is incorrect!');
  }

  if (!userData.otpExpiry || userData.otpExpiry <= currentTime) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Your OTP has expired. Please request a new one.',
    );
  }

  // Prepare common fields
  const updateData: any = {
    otp: null,
    otpExpiry: null,
  };

  // If user is not active, determine what else to update
  if (userData.status !== UserStatus.ACTIVE) {
    // updateData.status = UserStatus.ACTIVE;

    if (userData.intendedRole === UserRoleEnum.SALOON_OWNER) {
      updateData.intendedRole = UserRoleEnum.SALOON_OWNER;
      updateData.role = UserRoleEnum.SALOON_OWNER;
      updateData.isProfileComplete = false;
      updateData.isVerified = true;
    } else if (userData.intendedRole === UserRoleEnum.BARBER) {
      // updateData.intendedRole = UserRoleEnum.BARBER;
      updateData.role = UserRoleEnum.BARBER;
      updateData.isProfileComplete = true;
      updateData.isVerified = true;
      updateData.status = UserStatus.ACTIVE;
    } else {
      // any other role or null
      updateData.isVerified = true;
      updateData.isProfileComplete = true;
      updateData.status = UserStatus.ACTIVE;
    }
  }

  await prisma.user.update({
    where: { email: bodyData.email },
    data: updateData,
  });

  // Create a new Stripe customer
  const customer = await stripe.customers.create({
    name: userData.fullName,
    email: userData.email,
    address: {
      city: userData.address ?? 'City', // You can modify this as needed
      country: 'America', // You can modify this as needed
    },
    metadata: {
      userId: userData.id,
      role: userData.role,
    },
  });
  if (!customer || !customer.id) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Stripe customer not created!');
  }

  // Send notification to user about OTP verification
  try {
    if (userData?.fcmToken) {
      const message = `Welcome ${userData.fullName}! Your email has been verified successfully.`;

      await notificationService
        .sendNotification(
          userData.fcmToken,
          'Email Verified',
          message,
          userData.id,
        )
        .catch(error =>
          console.error('Error sending OTP verification notification:', error),
        );
    }
  } catch (error) {
    console.error('Error sending OTP verification notification:', error);
  }

  return { message: 'OTP verified successfully!' };
};

// verify otp
const verifyOtpForgotPasswordInDB = async (bodyData: {
  email: string;
  password: string;
  otp: number;
}) => {
  const userData = await prisma.user.findUnique({
    where: { email: bodyData.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.CONFLICT, 'User not found!');
  }
  const currentTime = new Date(Date.now());

  if (userData?.otp !== bodyData.otp) {
    throw new AppError(httpStatus.CONFLICT, 'Your OTP is incorrect!');
  } else if (!userData.otpExpiry || userData.otpExpiry <= currentTime) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Your OTP is expired, please send new otp',
    );
  }

  if (userData.status !== UserStatus.ACTIVE) {
    await prisma.user.update({
      where: { email: bodyData.email },
      data: {
        otp: null,
        otpExpiry: null,
        status: UserStatus.ACTIVE,
      },
    });
  } else {
    await prisma.user.update({
      where: { email: bodyData.email },
      data: {
        otp: null,
        otpExpiry: null,
      },
    });
  }

  return { message: 'OTP verified successfully!' };
};

// Define a type for the payload to improve type safety
interface SocialLoginPayload {
  fullName: string;
  email: string;
  image?: string | null;
  intendedRole?: UserRoleEnum;
  fcmToken: string;
  phoneNumber?: string | null;
  address?: string | null;
  plateForm: 'GOOGLE' | 'FACEBOOK' | 'APPLE';
}

const socialLoginIntoDB = async (payload: SocialLoginPayload) => {
  // Validate and sanitize role (default to CUSTOMER if invalid/missing)
  let userRole: UserRoleEnum = UserRoleEnum.CUSTOMER;
  if (
    payload.intendedRole &&
    Object.values(UserRoleEnum).includes(payload.intendedRole)
  ) {
    userRole = payload.intendedRole;
  }

  // Prevent creating an ADMIN via social sign-up
  if (
    userRole === UserRoleEnum.ADMIN ||
    userRole === UserRoleEnum.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Admin accounts cannot be created via social sign-up.',
    );
  }

  // Check if email is already used (for any role)
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      image: true,
      onBoarding: true,
      isSubscribed: true,
      subscriptionEnd: true,
      subscriptionPlan: true,
      isProfileComplete: true,
      status: true,
      intendedRole: true,
    },
  });

  // If user exists, check if they're trying to use the same email for a different role
  if (existingUser) {
    // Check if the existing user's role or intendedRole matches the requested role
    const matchesRole =
      existingUser.role === userRole || existingUser.intendedRole === userRole;

    if (!matchesRole) {
      throw new AppError(
        httpStatus.CONFLICT,
        `This email is already registered with a different role (${existingUser.role}). Please use a different email or log in with your existing account.`,
      );
    }
  }

  let userRecord = existingUser;
  let isNewUser = false;

  if (userRecord) {
    // Check profile completion
    // if (userRecord.isProfileComplete === false) {
    //   throw new AppError(
    //     httpStatus.BAD_REQUEST,
    //     'Please complete your profile before logging in',
    //   );
    // }

    // Check if account is blocked
    if (userRecord.status === UserStatus.BLOCKED) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Your account is blocked. Please contact support.',
      );
    }

    // For SALOON_OWNERS, check verification status
    if (userRecord.role === UserRoleEnum.SALOON_OWNER) {
      const saloon = await prisma.saloonOwner.findFirst({
        where: { userId: userRecord.id },
      });

      if (saloon?.isVerified === false) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Your saloon is not verified yet. Please wait for verification.',
        );
      }
    }
  } else {
    // Create new user
    const created = await prisma.user.create({
      data: {
        fullName: payload.fullName,
        email: payload.email,
        image: payload.image ?? null,
        role: userRole,
        status: UserStatus.ACTIVE,
        isVerified: true,
        fcmToken: payload.fcmToken,
        phoneNumber: payload.phoneNumber ?? null,
        address: payload.address ?? null,
        isProfileComplete:
          userRole === UserRoleEnum.CUSTOMER || userRole === UserRoleEnum.BARBER
            ? true
            : false, // Auto-complete profile for CUSTOMER and BARBER
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        image: true,
        onBoarding: true,
        isSubscribed: true,
        subscriptionEnd: true,
        subscriptionPlan: true,
      },
    });

    // Use created data with defaults (avoid re-fetch)
    userRecord = {
      ...created,
      status: UserStatus.ACTIVE,
      isProfileComplete: userRole === UserRoleEnum.CUSTOMER ? true : false,
      intendedRole: null,
      onBoarding: created.onBoarding ?? false,
      isSubscribed: created.isSubscribed ?? false,
      subscriptionEnd: created.subscriptionEnd ?? null,
      subscriptionPlan: created.subscriptionPlan ?? null,
    };

    isNewUser = true;
  }

  // Update FCM token for existing users (new users already have it set during create)
  if (!isNewUser && payload.fcmToken) {
    await prisma.user.update({
      where: { id: userRecord.id },
      data: { fcmToken: payload.fcmToken },
    });
  }

  // Helper to build tokens
  const buildTokensForUser = async (
    user: typeof userRecord,
  ): Promise<{ accessToken: string; refreshToken: string }> => {
    const accessToken = await generateToken(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        purpose: 'access',
        functions: [],
        subscriptionPlan: user.subscriptionPlan ?? SubscriptionPlanStatus.FREE,
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as any,
    );

    const refreshTokenValue = await refreshToken(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.refresh_secret as Secret,
      config.jwt.refresh_expires_in as any,
    );

    return { accessToken, refreshToken: refreshTokenValue };
  };

  const { accessToken, refreshToken: refreshTokenValue } =
    await buildTokensForUser(userRecord);

  // Prepare response based on role
  const response: any = {
    id: userRecord.id,
    name: userRecord.fullName,
    email: userRecord.email,
    role: userRecord.role,
    image: userRecord.image,
    accessToken,
    refreshToken: refreshTokenValue,
  };

  // Add role-specific fields
  if (userRecord.role === UserRoleEnum.SALOON_OWNER) {
    response.isSubscribed = userRecord.isSubscribed;
    response.subscriptionEnd = userRecord.subscriptionEnd;
    response.subscriptionPlan = userRecord.subscriptionPlan;
    response.onBoarding = userRecord.onBoarding;
  } else if (userRecord.role === UserRoleEnum.BARBER) {
    response.onBoarding = userRecord.onBoarding;
  }

  // Send notification to user about social login
  try {
    if (userRecord.id && payload.fcmToken) {
      const message = `Welcome back to Barbers Time, ${userRecord.fullName}!`;

      await notificationService
        .sendNotification(
          payload.fcmToken,
          'Login Successful',
          message,
          userRecord.id,
        )
        .catch(error =>
          console.error('Error sending social login notification:', error),
        );
    }
  } catch (error) {
    console.error('Error sending social login notification:', error);
  }

  return response;
};

const updatePasswordIntoDb = async (payload: any) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }
  const hashedPassword: string = await bcrypt.hash(payload.password, 12);
  const result = await prisma.user.update({
    where: {
      email: payload.email,
    },
    data: {
      password: hashedPassword,
    },
  });

  // Send notification to user about password update
  try {
    if (userData?.fcmToken) {
      const message = `Your password has been successfully updated.`;

      await notificationService
        .sendNotification(
          userData.fcmToken,
          'Password Updated',
          message,
          userData.id,
        )
        .catch(error =>
          console.error('Error sending password update notification:', error),
        );
    }
  } catch (error) {
    console.error('Error sending password update notification:', error);
  }

  return {
    message: 'Password updated successfully!',
  };
};

const deleteAccountFromDB = async (
  id: string,
  data: {
    reason?: string;
    password: string;
  },
) => {
  const userData = await prisma.user.findUnique({
    where: { id },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // match password from the user given input
  const checkPassword: boolean = await bcrypt.compare(
    data.password,
    userData.password!,
  );
  if (!checkPassword) {
    throw new AppError(httpStatus.CONFLICT, 'Password is incorrect!');
  }
  await prisma.user.update({
    where: { id },
    data: {
      status: UserStatus.BLOCKED,
      isDeleted: true,
      deleteReason: data.reason || 'No reason provided',
    },
  });

  // Send notification to user about account deletion
  try {
    if (userData?.fcmToken) {
      const message = `Your account has been successfully deleted. If this was a mistake, please contact support.`;

      await notificationService
        .sendNotification(userData.fcmToken, 'Account Deleted', message, id)
        .catch(error =>
          console.error('Error sending account deletion notification:', error),
        );
    }
  } catch (error) {
    console.error('Error sending account deletion notification:', error);
  }

  return { message: 'Account deleted successfully!' };
};

const updateProfileImageIntoDB = async (
  userId: string,
  profileImageUrl: string,
) => {
  // delete old image from aws s3 bucket
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });
  if (userData?.image) {
    await deleteFileFromSpace(userData.image).catch(error =>
      console.error('Error deleting old profile image from S3:', error),
    );
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      image: profileImageUrl,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      image: true,
    },
  });

  if (!updatedUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Profile image not updated!');
  }

  return updatedUser;
};

//  1. Update Saloon owner status:
const updateSaloonOwnerStatus = async (
  id: string,
  payload: TUpdateSaloonOwnerStatusTypePayload,
) => {
  // Find out the is user exists:
  const user = await prisma.user.findUnique({
    where: {
      id,
      role: UserRoleEnum.SALOON_OWNER,
    },
  });

  // 1. Check is user exists :
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, `User doesn't exist!`);
  }

  // 2. Check is user profile completed ?:
  if (!user.isProfileComplete) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `User profile haven't completed yet!`,
    );
  }

  // 3. Retrived user profile now :
  const saloonOwner = prisma.saloonOwner.findUnique({
    where: { userId: user.id },
  });

  if (!saloonOwner) {
    throw new AppError(httpStatus.NOT_FOUND, `User profile doesn't exist!`);
  }

  if (user.status === 'ACTIVE' && payload.status === 'ACTIVE') {
    throw new AppError(httpStatus.CONFLICT, `User is already approved!`);
  }

  if (user.status === 'BLOCKED' && payload.status === 'BLOCKED') {
    throw new AppError(httpStatus.CONFLICT, `User is already Blocked!`);
  }

  const result = await prisma.$transaction(async tx => {
    // 1. update the status in user table :
    const updatedUser = await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        status: payload.status,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        isProfileComplete: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (payload.status === 'ACTIVE') {
      await tx.saloonOwner.update({
        where: {
          userId: user.id,
        },
        data: {
          isVerified: true,
        },
      });
    }

    return updatedUser;
  });
};

export const UserServices = {
  registerUserIntoDB,
  registerSaloonOwnerIntoDB,
  updateSaloonOwnerIntoDB,
  updateBarberIntoDB,
  getMyProfileFromDB,
  getSaloonOwnerProfileFromDB,
  getBarberProfileFromDB,
  updateMyProfileIntoDB,
  updateUserRoleStatusIntoDB,
  changePassword,
  forgotPassword,
  verifyOtpInDB,
  sendReferenceImagesToAI,
  verifyOtpForgotPasswordInDB,
  socialLoginIntoDB,
  updatePasswordIntoDb,
  resendOtpIntoDB,
  resendUserVerificationEmail,
  deleteAccountFromDB,
  updateProfileImageIntoDB,
  updateSaloonOwnerStatus,
};
