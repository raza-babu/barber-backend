"use strict";
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
exports.followService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createFollowIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (data.followingId === userId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'You cannot follow yourself');
    }
    const followingUser = yield prisma_1.default.user.findUnique({
        where: {
            id: data.followingId,
            status: client_1.UserStatus.ACTIVE,
        },
    });
    if (!followingUser) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Following user not found');
    }
    const existingFollow = yield prisma_1.default.follow.findFirst({
        where: {
            userId: userId,
            followingId: data.followingId,
        },
    });
    if (existingFollow) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'You are already following this user');
    }
    try {
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const follow = yield tx.follow.create({
                data: Object.assign(Object.assign({}, data), { userId: userId }),
            });
            yield tx.user.update({
                where: { id: userId },
                data: {
                    followingCount: { increment: 1 },
                },
            });
            yield tx.user.update({
                where: { id: data.followingId },
                data: {
                    followerCount: { increment: 1 },
                },
            });
            return follow;
        }));
        return result;
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Transaction failed');
    }
});
const getFollowingListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.follow.findMany({
        where: {
            userId: userId,
        },
        select: {
            id: true,
            following: {
                select: {
                    id: true,
                    status: true,
                    fullName: true,
                    email: true,
                    phoneNumber: true,
                    image: true,
                    gender: true,
                    address: true,
                },
            },
            createdAt: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    if (result.length === 0) {
        return { message: 'No following found' };
    }
    return result
        .filter(item => item.following.status === client_1.UserStatus.ACTIVE)
        .map(item => ({
        id: item.id,
        followingId: item.following.id,
        followingName: item.following.fullName,
        followingEmail: item.following.email,
        followingPhoneNumber: item.following.phoneNumber,
        followingImage: item.following.image,
        followingGender: item.following.gender,
        followingAddress: item.following.address,
    }));
});
const getFollowListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.follow.findMany({
        where: {
            followingId: userId,
        },
        select: {
            id: true,
            follower: {
                select: {
                    id: true,
                    status: true,
                    fullName: true,
                    email: true,
                    phoneNumber: true,
                    image: true,
                    address: true,
                    gender: true,
                },
            },
            createdAt: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    if (result.length === 0) {
        return { message: 'No follower found' };
    }
    return result
        .filter(item => item.follower.status === client_1.UserStatus.ACTIVE)
        .map(item => ({
        id: item.id,
        followerId: item.follower.id,
        followerName: item.follower.fullName,
        followerEmail: item.follower.email,
        followerPhoneNumber: item.follower.phoneNumber,
        followerImage: item.follower.image,
        followerAddress: item.follower.address,
        followerGender: item.follower.gender,
    }));
});
const getFollowByIdFromDb = (userId, followId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.follow.findUnique({
        where: {
            id: followId,
            OR: [
                { userId: userId },
                { followingId: userId },
            ]
        },
        select: {
            id: true,
            following: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phoneNumber: true,
                    image: true,
                    status: true,
                },
            },
        },
    });
    if (!result || result.following.status !== client_1.UserStatus.ACTIVE) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'follow not found');
    }
    return {
        id: result.id,
        followingId: result.following.id,
        followingName: result.following.fullName,
        followingEmail: result.following.email,
        followingPhoneNumber: result.following.phoneNumber,
        followingImage: result.following.image,
    };
});
const updateFollowIntoDb = (userId, followId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.follow.update({
        where: {
            id: followId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'followId, not updated');
    }
    return result;
});
const deleteFollowingFromDb = (userId, followId) => __awaiter(void 0, void 0, void 0, function* () {
    const follow = yield prisma_1.default.follow.findFirst({
        where: {
            followingId: followId,
            userId: userId,
        },
    });
    if (!follow) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Follow not found');
    }
    const existingFollowing = yield prisma_1.default.user.findUnique({
        where: {
            id: follow.followingId,
            status: client_1.UserStatus.ACTIVE,
        },
    });
    if (!existingFollowing) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Following user not found');
    }
    try {
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const deletedItem = yield tx.follow.deleteMany({
                where: {
                    followingId: followId,
                    userId: userId,
                },
            });
            const followingId = follow.followingId;
            const findFollowingProfile = yield tx.user.findUnique({
                where: {
                    id: followingId,
                    status: client_1.UserStatus.ACTIVE,
                },
            });
            if (!findFollowingProfile) {
                throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Following profile not found');
            }
            const deletedFollowingProfile = yield tx.user.update({
                where: {
                    id: followingId,
                    status: client_1.UserStatus.ACTIVE,
                },
                data: {
                    followerCount: {
                        decrement: 1,
                    },
                },
            });
            if (!deletedFollowingProfile) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Following profile not updated');
            }
            const deletedOwnProfile = yield tx.user.update({
                where: {
                    id: userId,
                    status: client_1.UserStatus.ACTIVE,
                },
                data: {
                    followingCount: {
                        decrement: 1,
                    },
                },
            });
            if (!deletedOwnProfile) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Own profile not updated');
            }
            return deletedItem;
        }));
        return result;
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Transaction failed');
    }
});
exports.followService = {
    createFollowIntoDb,
    getFollowingListFromDb,
    getFollowListFromDb,
    getFollowByIdFromDb,
    updateFollowIntoDb,
    deleteFollowingFromDb,
};
