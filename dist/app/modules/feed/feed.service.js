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
exports.feedService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createFeedIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    let saloonOwner;
    if (userId) {
        saloonOwner = yield prisma_1.default.saloonOwner.findFirst({
            where: {
                userId: userId,
            },
        });
    }
    const result = yield prisma_1.default.feed.create({
        data: Object.assign(Object.assign({}, data), { userId: userId, saloonOwnerId: saloonOwner ? saloonOwner.id : null }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'feed not created');
    }
    return result;
});
const getFeedListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    // if(userId) {
    //   const user = await prisma.user.findUnique({
    //     where: {
    //       id: userId,
    //     },
    //   });
    //   if(user?.role !== UserRoleEnum.CUSTOMER) {
    //     throw new AppError(httpStatus.FORBIDDEN, 'Only customers can view the feed');
    //   }
    // }
    const result = yield prisma_1.default.feed.findMany({
        include: {
            user: {
                select: {
                    id: true,
                    fullName: true,
                    image: true,
                },
            },
            shop: {
                select: {
                    id: true,
                    userId: true,
                    shopName: true,
                    shopLogo: true,
                    avgRating: true,
                    ratingCount: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    if (result.length === 0) {
        return [];
    }
    return result;
});
const getFeedByIdFromDb = (feedId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.feed.findUnique({
        where: {
            id: feedId,
        },
        include: {
            user: {
                select: {
                    id: true,
                    fullName: true,
                    image: true,
                },
            },
            shop: {
                select: {
                    id: true,
                    userId: true,
                    shopName: true,
                    shopLogo: true,
                    avgRating: true,
                    ratingCount: true,
                },
            },
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'feed not found');
    }
    return result;
});
const updateFeedIntoDb = (userId, feedId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.feed.update({
        where: {
            id: feedId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'feedId, not updated');
    }
    return result;
});
const deleteFeedItemFromDb = (userId, feedId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.feed.delete({
        where: {
            id: feedId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'feedId, not deleted');
    }
    return deletedItem;
});
exports.feedService = {
    createFeedIntoDb,
    getFeedListFromDb,
    getFeedByIdFromDb,
    updateFeedIntoDb,
    deleteFeedItemFromDb,
};
