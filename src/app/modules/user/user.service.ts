import { SaloonOwner } from './../../../../node_modules/.prisma/client/index.d';
import { User, UserStatus, UserRoleEnum } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../../config';
import AppError from '../../errors/AppError';
import emailSender from '../../utils/emailSender';
import { generateToken, refreshToken } from '../../utils/generateToken';
import prisma from '../../utils/prisma';

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
      throw new AppError(httpStatus.CONFLICT, 'User already exists!');
    }
  }

  const hashedPassword: string = await bcrypt.hash(payload.password, 12);

  const userData = {
    ...payload,
    password: hashedPassword,
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
  const otp = Math.floor(100000 + Math.random() * 900000);
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
      <td style="background-color: #000000; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
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
        <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Storage manager</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Storage Team. All rights reserved.</p>
      </td>
    </tr>
    </table>
  </div>

      `,
  );
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
  const otp = Math.floor(100000 + Math.random() * 900000);
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

    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #000000; padding: 20px; text-align: center; color: #f5f5f5; border-radius: 10px 10px 0 0;">
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
        <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Storage manager</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Storage manager Team. All rights reserved.</p>
      </td>
    </tr>
    </table>
  </div>

      `,
  );

  return { message: 'OTP sent via your email successfully' };
};

const registerSaloonOwnerIntoDB = async (payload: any) => {
  if (payload.email) {
    const existingUser = await prisma.user.findUnique({
      where: {
        email: payload.email,
      },
    });
    if (!existingUser) {
      throw new AppError(httpStatus.CONFLICT, 'User not exists!');
    }
    if(existingUser.password !== null) {
      const isCorrectPassword: Boolean = await bcrypt.compare(
    payload.password,
    existingUser.password,
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect');
  }
}

    const existingSaloonOwner = await prisma.saloonOwner.findUnique({
      where: {
        userId: existingUser.id,
      },
    });
    if (existingSaloonOwner) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Saloon owner already exists for this user!',
      );
    }
  }
  
  const result = await prisma.$transaction(async (transactionClient: any) => {
    const updateUserRole = await transactionClient.user.update({
      where: { email: payload.email },
      data: {
        role: UserRoleEnum.SALOON_OWNER,
      },
    });
    if (!updateUserRole) {
      throw new AppError(httpStatus.BAD_REQUEST, 'User role not updated!');
    }
    const user = await transactionClient.SaloonOwner.create({
      data: payload,
    });
    if (!user) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Saloon shop is not created!');
    }
  });
  return result;
}

const registerBarberIntoDB = async (payload: any) => {
  if (payload.email) {
    const existingUser = await prisma.user.findUnique({
      where: {
        email: payload.email,
      },
    });
    if (!existingUser) {
      throw new AppError(httpStatus.CONFLICT, 'User not exists!');
    }
    if(existingUser.password !== null) {
      const isCorrectPassword: Boolean = await bcrypt.compare(
    payload.password,
    existingUser.password,
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect');
  }
}

    const existingBarber = await prisma.barber.findUnique({
      where: {
        userId: existingUser.id,
      },
    });
    if (existingBarber) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Barber already exists for this user!',
      );
    }
  }

  const result = await prisma.$transaction(async (transactionClient: any) => {
    const updateUserRole = await transactionClient.user.update({
      where: { email: payload.email },
      data: {
        role: UserRoleEnum.BARBER,
      },
    });
    if (!updateUserRole) {
      throw new AppError(httpStatus.BAD_REQUEST, 'User role not updated!');
    }
    const user = await transactionClient.barber.create({
      data: payload,
    });
    if (!user) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Barber is not created!');
    }
  });
  return result;
}

const getMyProfileFromDB = async (id: string) => {
  const Profile = await prisma.user.findUniqueOrThrow({
    where: {
      id: id,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Profile;
};

const updateMyProfileIntoDB = async (id: string, payload: any) => {
  const userData = payload;

  // update user data
  await prisma.$transaction(async (transactionClient: any) => {
    // Update user data
    const updatedUser = await transactionClient.user.update({
      where: { id },
      data: userData,
    });

    return { updatedUser };
  });

  // Fetch and return the updated user including the profile
  const updatedUser = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  });

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

const changePassword = async (user: any, userId: string, payload: any) => {
  const userData = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId,
      email: user.email,
      status: UserStatus.ACTIVE,
    },
  });

  if(userData.password === null) {
    throw new AppError(httpStatus.CONFLICT, 'Password not set for this user');
  }

  const isCorrectPassword: boolean = await bcrypt.compare(
    payload.oldPassword,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new Error('Password incorrect!');
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

  const otp = Math.floor(100000 + Math.random() * 900000);
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
      <td style="background-color: #000000; padding: 20px; text-align: center; color: #f5f5f5; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Reset password OTP</h2>
      </td>
    </tr>
    <tr>0
      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${
          userData.fullName
        }</strong>,</p>
        <p style="font-size: 16px;">Please verify your email.</p>
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 18px;" >Verify email using this OTP: <span style="font-weight:bold"> ${otp} </span><br/> This OTP will be Expired in 5 minutes,</p>
        </div>
        <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
        <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Storage manager</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Storage manager Team. All rights reserved.</p>
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
  const otp = Math.floor(100000 + Math.random() * 900000);
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
      <td style="background-color: #000000; padding: 20px; text-align: center; color: #f5f5f5; border-radius: 10px 10px 0 0;">
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
        <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Storage manager</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Storage manager Team. All rights reserved.</p>
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
  if (!userData.email) {
    throw new AppError(httpStatus.CONFLICT, 'Email not set for this user');
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

const socialLoginIntoDB = async (payload: any) => {
  const user = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (!user) {
    const newUser = await prisma.user.create({
      data: {
        ...payload,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,

      },
    });
    const accessToken = await generateToken(
      {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        purpose: 'access',
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as string,
    );

    const refreshedToken = await refreshToken(
        {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
        },
        config.jwt.refresh_secret as Secret,
        config.jwt.refresh_expires_in as string,
      );

    return { newUser, accessToken, refreshedToken };
  }
  if (user) {
    const fcmUpdate = await prisma.user.update({
      where: { email: payload.email },
      data: {
        fcmToken: payload.fcmToken,
      },
    });
    const accessToken = await generateToken(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        purpose: 'access',
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as string,
    );
    const refreshedToken = await refreshToken(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwt.refresh_secret as Secret,
      config.jwt.refresh_expires_in as string,
    );
    return { user, accessToken, refreshedToken };
  }
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
  return {
    message: 'Password updated successfully!',
  };
};

const deleteAccountFromDB = async (id: string) => {
  const userData = await prisma.user.findUnique({
    where: { id },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  await prisma.user.delete({
    where: { id },
  });

  return { message: 'Account deleted successfully!' };
};

const updateProfileImageIntoDB = async (
  userId: string,
  profileImageUrl: string,
) => {
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

export const UserServices = {
  registerUserIntoDB,
  registerSaloonOwnerIntoDB,
  registerBarberIntoDB,
  getMyProfileFromDB,
  updateMyProfileIntoDB,
  updateUserRoleStatusIntoDB,
  changePassword,
  forgotPassword,
  verifyOtpInDB,
  verifyOtpForgotPasswordInDB,
  socialLoginIntoDB,
  updatePasswordIntoDb,
  resendOtpIntoDB,
  resendUserVerificationEmail,
  deleteAccountFromDB,
  updateProfileImageIntoDB,
};
