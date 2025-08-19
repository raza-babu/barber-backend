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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthServices = void 0;
const bcrypt = __importStar(require("bcrypt"));
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../../../config"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const generateToken_1 = require("../../utils/generateToken");
const prisma_1 = __importDefault(require("../../utils/prisma"));
const verifyToken_1 = require("../../utils/verifyToken");
const client_1 = require("@prisma/client");
const loginUserFromDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield prisma_1.default.user.findUniqueOrThrow({
        where: {
            email: payload.email,
        },
    });
    if (userData.password === null) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Password is not set');
    }
    const isCorrectPassword = yield bcrypt.compare(payload.password, userData.password);
    if (!isCorrectPassword) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Password incorrect');
    }
    if (userData.isProfileComplete === false || userData.isProfileComplete === null) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Please complete your profile before logging in');
    }
    if (userData.status === client_1.UserStatus.BLOCKED) {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Your account is blocked. Please contact support.');
    }
    if (userData.role === client_1.UserRoleEnum.SALOON_OWNER) {
        const saloon = yield prisma_1.default.saloonOwner.findFirst({
            where: {
                userId: userData.id,
            },
        });
        if ((saloon === null || saloon === void 0 ? void 0 : saloon.isVerified) === false) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Your saloon is not verified yet. Please wait for verification.');
        }
    }
    if (userData.role === client_1.UserRoleEnum.ADMIN) {
        const admin = yield prisma_1.default.admin.findFirst({
            where: {
                userId: userData.id,
            },
        });
        if (admin) {
        }
    }
    if (userData.isLoggedIn === false) {
        const updateUser = yield prisma_1.default.user.update({
            where: { id: userData.id },
            data: { isLoggedIn: true },
        });
        if (!updateUser) {
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'User login failed');
        }
    }
    const accessToken = yield (0, generateToken_1.generateToken)({
        id: userData.id,
        email: userData.email,
        role: userData.role,
        purpose: 'access',
    }, config_1.default.jwt.access_secret, config_1.default.jwt.access_expires_in);
    const refreshedToken = yield (0, generateToken_1.refreshToken)({
        id: userData.id,
        email: userData.email,
        role: userData.role,
    }, config_1.default.jwt.refresh_secret, config_1.default.jwt.refresh_expires_in);
    return {
        id: userData.id,
        name: userData.fullName,
        email: userData.email,
        role: userData.role,
        image: userData.image,
        accessToken: accessToken,
        refreshToken: refreshedToken,
    };
});
const refreshTokenFromDB = (refreshedToken) => __awaiter(void 0, void 0, void 0, function* () {
    if (!refreshedToken) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Refresh token is required');
    }
    const decoded = yield (0, verifyToken_1.verifyToken)(refreshedToken, config_1.default.jwt.refresh_secret);
    if (!decoded) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Invalid refresh token');
    }
    const userData = yield prisma_1.default.user.findUniqueOrThrow({
        where: {
            id: decoded.id,
            status: client_1.UserStatus.ACTIVE,
        },
    });
    if (!userData) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    const newAccessToken = yield (0, generateToken_1.generateToken)({
        id: userData.id,
        email: userData.email,
        role: userData.role,
        purpose: 'access',
    }, config_1.default.jwt.access_secret, config_1.default.jwt.access_expires_in);
    const newRefreshToken = yield (0, generateToken_1.refreshToken)({
        id: userData.id,
        email: userData.email,
        role: userData.role,
    }, config_1.default.jwt.refresh_secret, config_1.default.jwt.refresh_expires_in);
    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
    };
});
const logoutUserFromDB = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma_1.default.user.update({
        where: { id: userId },
        data: { isLoggedIn: false },
    });
});
exports.AuthServices = {
    loginUserFromDB,
    logoutUserFromDB,
    refreshTokenFromDB,
};
