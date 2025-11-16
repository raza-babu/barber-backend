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
const deleteImage_1 = require("../../utils/deleteImage");
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
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'feed not created');
    }
    return result;
});
// ...existing code...
const getFeedListFromDb = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, page = 1, limit = 10) {
    // Coerce and validate inputs so `take` is always a valid integer for Prisma
    const take = Math.max(1, Math.min(100, Number(limit) || 10)); // cap limit (1..100)
    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * take;
    // fetch page + total in a transaction
    const [result, total] = yield prisma_1.default.$transaction([
        prisma_1.default.feed.findMany({
            skip,
            take,
            select: {
                id: true,
                favoriteCount: true,
                caption: true,
                images: true,
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        image: true,
                        SaloonOwner: {
                            select: {
                                userId: true,
                                registrationNumber: true,
                                shopName: true,
                                shopAddress: true,
                                shopImages: true,
                                shopVideo: true,
                                shopLogo: true,
                                avgRating: true,
                                ratingCount: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        }),
        prisma_1.default.feed.count(),
    ]);
    if (result.length === 0) {
        return {
            items: [],
            meta: {
                total,
                page: pageNum,
                limit: take,
                totalPages: Math.ceil(total / take),
            },
        };
    }
    // favorites for returned feeds
    const favorites = userId
        ? yield prisma_1.default.favoriteFeed.findMany({
            where: {
                userId: userId,
                feedId: { in: result.map(feed => feed.id) },
            },
        })
        : [];
    const favoriteFeedIds = favorites.map((fav) => fav.feedId);
    const items = result.map(feed => ({
        id: feed.id,
        userId: feed.user.id,
        userName: feed.user.fullName,
        userImage: feed.user.image,
        caption: feed.caption,
        images: feed.images,
        favoriteCount: feed.favoriteCount,
        isFavorite: userId ? favoriteFeedIds.includes(feed.id) : false,
        saloonOwner: feed.user.SaloonOwner && feed.user.SaloonOwner.length > 0
            ? {
                userId: feed.user.SaloonOwner[0].userId,
                shopName: feed.user.SaloonOwner[0].shopName,
                registration: feed.user.SaloonOwner[0].registrationNumber,
                shopAddress: feed.user.SaloonOwner[0].shopAddress,
                shopImages: feed.user.SaloonOwner[0].shopImages,
                shopVideo: feed.user.SaloonOwner[0].shopVideo,
                shopLogo: feed.user.SaloonOwner[0].shopLogo,
                avgRating: feed.user.SaloonOwner[0].avgRating,
                ratingCount: feed.user.SaloonOwner[0].ratingCount,
            }
            : null,
    }));
    return {
        items,
        meta: {
            total,
            page: pageNum,
            limit: take,
            totalPages: Math.ceil(total / take),
        },
    };
});
// ...existing code...
const getMyFeedsFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!userId) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'User not authenticated');
    }
    const result = yield prisma_1.default.feed.findMany({
        where: {
            userId: userId,
        },
        select: {
            id: true,
            favoriteCount: true,
            caption: true,
            images: true,
            user: {
                select: {
                    id: true,
                    fullName: true,
                    image: true,
                    SaloonOwner: {
                        select: {
                            userId: true,
                            registrationNumber: true,
                            shopName: true,
                            shopAddress: true,
                            shopImages: true,
                            shopVideo: true,
                            shopLogo: true,
                            avgRating: true,
                            ratingCount: true,
                        },
                    },
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
    return result.map(feed => ({
        id: feed.id,
        userId: feed.user.id,
        userName: feed.user.fullName,
        userImage: feed.user.image,
        caption: feed.caption,
        images: feed.images,
        favoriteCount: feed.favoriteCount,
        saloonOwner: feed.user.SaloonOwner && feed.user.SaloonOwner.length > 0
            ? {
                userId: feed.user.SaloonOwner[0].userId,
                shopName: feed.user.SaloonOwner[0].shopName,
                registration: feed.user.SaloonOwner[0].registrationNumber,
                shopAddress: feed.user.SaloonOwner[0].shopAddress,
                shopImages: feed.user.SaloonOwner[0].shopImages,
                shopVideo: feed.user.SaloonOwner[0].shopVideo,
                shopLogo: feed.user.SaloonOwner[0].shopLogo,
                avgRating: feed.user.SaloonOwner[0].avgRating,
                ratingCount: feed.user.SaloonOwner[0].ratingCount,
            }
            : null,
    }));
});
const getFeedByIdFromDb = (feedId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.feed.findUnique({
        where: {
            id: feedId,
        },
        select: {
            id: true,
            favoriteCount: true,
            caption: true,
            images: true,
            user: {
                select: {
                    id: true,
                    fullName: true,
                    image: true,
                    SaloonOwner: {
                        select: {
                            userId: true,
                            shopName: true,
                            shopAddress: true,
                            shopImages: true,
                            shopVideo: true,
                            shopLogo: true,
                            avgRating: true,
                            ratingCount: true,
                        },
                    },
                },
            },
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'feed not found');
    }
    return {
        id: result.id,
        userId: result.user.id,
        userName: result.user.fullName,
        userImage: result.user.image,
        caption: result.caption,
        images: result.images,
        favoriteCount: result.favoriteCount,
        saloonOwner: result.user.SaloonOwner && result.user.SaloonOwner.length > 0
            ? {
                userId: result.user.SaloonOwner[0].userId,
                shopName: result.user.SaloonOwner[0].shopName,
                shopAddress: result.user.SaloonOwner[0].shopAddress,
                shopImages: result.user.SaloonOwner[0].shopImages,
                shopVideo: result.user.SaloonOwner[0].shopVideo,
                shopLogo: result.user.SaloonOwner[0].shopLogo,
                avgRating: result.user.SaloonOwner[0].avgRating,
                ratingCount: result.user.SaloonOwner[0].ratingCount,
            }
            : null,
    };
});
const updateFeedIntoDb = (userId, feedId, data, existingImages) => __awaiter(void 0, void 0, void 0, function* () {
    const feed = yield prisma_1.default.feed.findUnique({
        where: { id: feedId },
    });
    if (!feed) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Feed not found");
    }
    // Update DB
    const result = yield prisma_1.default.feed.update({
        where: {
            id: feedId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    // Delete images removed by the client
    const removedImages = (feed.images || []).filter(img => !data.images.includes(img));
    for (const img of removedImages) {
        yield (0, deleteImage_1.deleteFileFromSpace)(img); // your DO Spaces delete helper
        console.log("Deleted feed image from space:", img);
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
    getMyFeedsFromDb,
    getFeedByIdFromDb,
    updateFeedIntoDb,
    deleteFeedItemFromDb,
};
