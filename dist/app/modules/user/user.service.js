"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserServices = void 0;
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../../../config"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const emailSender_1 = __importDefault(require("../../utils/emailSender"));
const generateToken_1 = require("../../utils/generateToken");
const prisma_1 = __importDefault(require("../../utils/prisma"));
const registerUserIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (payload.email) {
        const existingUser = yield prisma_1.default.user.findUnique({
            where: {
                email: payload.email,
            },
        });
        if (existingUser) {
            throw new AppError_1.default(http_status_1.default.CONFLICT, 'User already exists!');
        }
    }
    const hashedPassword = yield bcrypt.hash(payload.password, 12);
    const userData = Object.assign(Object.assign({}, payload), { password: hashedPassword, intendedRole: payload.intendedRole
            ? payload.intendedRole
            : client_1.UserRoleEnum.CUSTOMER });
    const result = yield prisma_1.default.$transaction((transactionClient) => __awaiter(void 0, void 0, void 0, function* () {
        const user = yield transactionClient.user.create({
            data: userData,
        });
        if (!user) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'User not created!');
        }
    }));
    // return login;
    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpiresAt = new Date();
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);
    const otpExpiresAtString = otpExpiresAt.toISOString();
    yield prisma_1.default.user.update({
        where: { email: payload.email },
        data: {
            otp: otp,
            otpExpiry: otpExpiresAtString,
        },
    });
    yield (0, emailSender_1.default)('Verify Your Email', userData.email, `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Verify your email</h2>
      </td>
    </tr>
    <tr>

      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${userData.fullName}</strong>,</p>
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

      `);
    return { message: 'OTP sent via your email successfully' };
});
//resend verification email
const resendUserVerificationEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield prisma_1.default.user.findUnique({
        where: { email: email },
    });
    if (!userData) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found!');
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpiresAt = new Date();
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);
    const otpExpiresAtString = otpExpiresAt.toISOString();
    yield prisma_1.default.user.update({
        where: { email: email },
        data: {
            otp: otp,
            otpExpiry: otpExpiresAtString,
        },
    });
    if (!userData.email) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, 'Email not set for this user');
    }
    yield (0, emailSender_1.default)('Verify Your Email', userData.email, `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #000000; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #f5f5f5; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Verify Your Email</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${userData.fullName}</strong>,</p>
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

      `);
    return { message: 'OTP sent via your email successfully' };
});
const registerSaloonOwnerIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = payload;
    let userId;
    if (email) {
        const existingUser = yield prisma_1.default.user.findUnique({
            where: { email },
        });
        userId = existingUser === null || existingUser === void 0 ? void 0 : existingUser.id;
        if (!existingUser) {
            throw new AppError_1.default(http_status_1.default.CONFLICT, 'User not exists!');
        }
        const existingSaloonOwner = yield prisma_1.default.saloonOwner.findUnique({
            where: { userId: existingUser.id },
        });
        if (existingSaloonOwner) {
            throw new AppError_1.default(http_status_1.default.CONFLICT, 'Saloon owner already exists for this user!');
        }
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Exclude 'email' from payload before creating saloon owner
            const { email } = payload, saloonOwnerData = __rest(payload, ["email"]);
            const createdSaloonOwner = yield tx.saloonOwner.create({
                data: Object.assign(Object.assign({}, saloonOwnerData), { userId: userId }),
            });
            const updatedUser = yield tx.user.update({
                where: { email, intendedRole: client_1.UserRoleEnum.SALOON_OWNER },
                data: {
                    role: client_1.UserRoleEnum.SALOON_OWNER,
                    intendedRole: null,
                    isProfileComplete: true,
                },
            });
            if (!updatedUser) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'User role not updated!');
            }
            if (!createdSaloonOwner) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon shop not created!');
            }
            return createdSaloonOwner;
        }));
        return result;
    }
    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Email is required!');
});
const updateSaloonOwnerIntoDB = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (userId) {
        const existingUser = yield prisma_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!existingUser) {
            throw new AppError_1.default(http_status_1.default.CONFLICT, 'User not exists!');
        }
        const existingSaloonOwner = yield prisma_1.default.saloonOwner.findUnique({
            where: { userId: existingUser.id },
        });
        if (!existingSaloonOwner) {
            throw new AppError_1.default(http_status_1.default.CONFLICT, 'Saloon owner does not exist for this user!');
        }
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const updatedSaloonOwner = yield tx.saloonOwner.update({
                where: { userId: existingUser.id },
                data: payload,
            });
            if (!updatedSaloonOwner) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon shop not updated!');
            }
            return updatedSaloonOwner;
        }));
        return result;
    }
    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Email is required!');
});
const updateBarberIntoDB = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    let existingUser;
    if (userId) {
        existingUser = yield prisma_1.default.user.findUnique({
            where: {
                id: userId
            },
        });
        if (!existingUser) {
            throw new AppError_1.default(http_status_1.default.CONFLICT, 'User not exists!');
        }
        const existingBarber = yield prisma_1.default.barber.findUnique({
            where: {
                userId: existingUser.id,
            },
        });
        if (!existingBarber) {
            const barber = yield prisma_1.default.barber.create({
                data: {
                    userId: existingUser.id,
                },
            });
            if (!barber) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber is not created!');
            }
        }
    }
    const result = yield prisma_1.default.$transaction((transactionClient) => __awaiter(void 0, void 0, void 0, function* () {
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
        const user = yield transactionClient.barber.update({
            where: { userId: existingUser.id },
            data: payload,
        });
        if (!user) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber is not created!');
        }
    }));
    // Fetch and return the updated barber details including related user info
    const updatedBarber = yield prisma_1.default.barber.findUnique({
        where: { userId: existingUser.id },
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
});
const getMyProfileFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const Profile = yield prisma_1.default.user.findUniqueOrThrow({
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
});
const updateMyProfileIntoDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = payload;
    // update user data
    yield prisma_1.default.$transaction((transactionClient) => __awaiter(void 0, void 0, void 0, function* () {
        // Update user data
        const updatedUser = yield transactionClient.user.update({
            where: { id },
            data: userData,
        });
        return { updatedUser };
    }));
    // Fetch and return the updated user
    const updatedUser = yield prisma_1.default.user.findUniqueOrThrow({
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
    // const userWithOptionalPassword = updatedUser as UserWithOptionalPassword;
    // delete userWithOptionalPassword.password;
    return updatedUser;
});
const updateUserRoleStatusIntoDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.user.update({
        where: {
            id: id,
        },
        data: payload,
    });
    return result;
});
const changePassword = (user, userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield prisma_1.default.user.findUniqueOrThrow({
        where: {
            id: userId,
            email: user.email,
            status: client_1.UserStatus.ACTIVE,
        },
    });
    if (userData.password === null) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, 'Password not set for this user');
    }
    const isCorrectPassword = yield bcrypt.compare(payload.oldPassword, userData.password);
    if (!isCorrectPassword) {
        throw new Error('Password incorrect!');
    }
    const hashedPassword = yield bcrypt.hash(payload.newPassword, 12);
    yield prisma_1.default.user.update({
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
});
const forgotPassword = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield prisma_1.default.user.findUnique({
        where: {
            email: payload.email,
        },
    });
    if (!userData) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, 'User not found!');
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpiresAt = new Date();
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);
    const otpExpiresAtString = otpExpiresAt.toISOString();
    yield prisma_1.default.user.update({
        where: { email: payload.email },
        data: {
            otp: otp,
            otpExpiry: otpExpiresAtString,
        },
    });
    if (!userData.email) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, 'Email not set for this user');
    }
    yield (0, emailSender_1.default)('Verify Your Email', userData.email, `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Reset password OTP</h2>
      </td>
    </tr>
    <tr>

      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${userData.fullName}</strong>,</p>
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

      `);
    return { message: 'OTP sent via your email successfully' };
});
//resend otp
const resendOtpIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield prisma_1.default.user.findUnique({
        where: { email: payload.email },
    });
    if (!userData) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found!');
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpiresAt = new Date();
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);
    const otpExpiresAtString = otpExpiresAt.toISOString();
    yield prisma_1.default.user.update({
        where: { email: payload.email },
        data: {
            otp: otp,
            otpExpiry: otpExpiresAtString,
        },
    });
    if (!userData.email) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, 'Email not set for this user');
    }
    yield (0, emailSender_1.default)('Verify Your Email', userData.email, `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #000000; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #f5f5f5; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Reset Password OTP</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${userData.fullName}</strong>,</p>
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

      `);
    return { message: 'OTP sent via your email successfully' };
});
// verify otp
const verifyOtpInDB = (bodyData) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield prisma_1.default.user.findUnique({
        where: { email: bodyData.email },
    });
    if (!userData) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, 'User not found!');
    }
    const currentTime = new Date();
    if (userData.otp !== bodyData.otp) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, 'Your OTP is incorrect!');
    }
    if (!userData.otpExpiry || userData.otpExpiry <= currentTime) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, 'Your OTP has expired. Please request a new one.');
    }
    // Prepare common fields
    const updateData = {
        otp: null,
        otpExpiry: null,
    };
    // If user is not active, determine what else to update
    if (userData.status !== client_1.UserStatus.ACTIVE) {
        updateData.status = client_1.UserStatus.ACTIVE;
        if (userData.intendedRole === client_1.UserRoleEnum.SALOON_OWNER) {
            updateData.intendedRole = client_1.UserRoleEnum.SALOON_OWNER;
            updateData.role = client_1.UserRoleEnum.SALOON_OWNER;
            updateData.isProfileComplete = false;
        }
        else if (userData.intendedRole === client_1.UserRoleEnum.BARBER) {
            // updateData.intendedRole = UserRoleEnum.BARBER;
            updateData.role = client_1.UserRoleEnum.BARBER;
            updateData.isProfileComplete = true;
        }
        else {
            // any other role or null
            updateData.isProfileComplete = true;
        }
    }
    yield prisma_1.default.user.update({
        where: { email: bodyData.email },
        data: updateData,
    });
    return { message: 'OTP verified successfully!' };
});
// verify otp
const verifyOtpForgotPasswordInDB = (bodyData) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield prisma_1.default.user.findUnique({
        where: { email: bodyData.email },
    });
    if (!userData) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, 'User not found!');
    }
    const currentTime = new Date(Date.now());
    if ((userData === null || userData === void 0 ? void 0 : userData.otp) !== bodyData.otp) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, 'Your OTP is incorrect!');
    }
    else if (!userData.otpExpiry || userData.otpExpiry <= currentTime) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, 'Your OTP is expired, please send new otp');
    }
    if (userData.status !== client_1.UserStatus.ACTIVE) {
        yield prisma_1.default.user.update({
            where: { email: bodyData.email },
            data: {
                otp: null,
                otpExpiry: null,
                status: client_1.UserStatus.ACTIVE,
            },
        });
    }
    else {
        yield prisma_1.default.user.update({
            where: { email: bodyData.email },
            data: {
                otp: null,
                otpExpiry: null,
            },
        });
    }
    return { message: 'OTP verified successfully!' };
});
const socialLoginIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield prisma_1.default.user.findUnique({
        where: {
            email: payload.email,
        },
    });
    if (!user) {
        const newUser = yield prisma_1.default.user.create({
            data: Object.assign(Object.assign({}, payload), { status: client_1.UserStatus.ACTIVE }),
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
            },
        });
        const accessToken = yield (0, generateToken_1.generateToken)({
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
            purpose: 'access',
        }, config_1.default.jwt.access_secret, config_1.default.jwt.access_expires_in);
        const refreshedToken = yield (0, generateToken_1.refreshToken)({
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
        }, config_1.default.jwt.refresh_secret, config_1.default.jwt.refresh_expires_in);
        return { newUser, accessToken, refreshedToken };
    }
    if (user) {
        const fcmUpdate = yield prisma_1.default.user.update({
            where: { email: payload.email },
            data: {
                fcmToken: payload.fcmToken,
            },
        });
        const accessToken = yield (0, generateToken_1.generateToken)({
            id: user.id,
            email: user.email,
            role: user.role,
            purpose: 'access',
        }, config_1.default.jwt.access_secret, config_1.default.jwt.access_expires_in);
        const refreshedToken = yield (0, generateToken_1.refreshToken)({
            id: user.id,
            email: user.email,
            role: user.role,
        }, config_1.default.jwt.refresh_secret, config_1.default.jwt.refresh_expires_in);
        return { user, accessToken, refreshedToken };
    }
});
const updatePasswordIntoDb = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield prisma_1.default.user.findUnique({
        where: { email: payload.email },
    });
    if (!userData) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found!');
    }
    const hashedPassword = yield bcrypt.hash(payload.password, 12);
    const result = yield prisma_1.default.user.update({
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
});
const deleteAccountFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield prisma_1.default.user.findUnique({
        where: { id },
    });
    if (!userData) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found!');
    }
    yield prisma_1.default.user.delete({
        where: { id },
    });
    return { message: 'Account deleted successfully!' };
});
const updateProfileImageIntoDB = (userId, profileImageUrl) => __awaiter(void 0, void 0, void 0, function* () {
    const updatedUser = yield prisma_1.default.user.update({
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
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Profile image not updated!');
    }
    return updatedUser;
});
exports.UserServices = {
    registerUserIntoDB,
    registerSaloonOwnerIntoDB,
    updateSaloonOwnerIntoDB,
    updateBarberIntoDB,
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
