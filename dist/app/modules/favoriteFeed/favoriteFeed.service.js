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
exports.favoriteFeedService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const pagination_1 = require("../../utils/pagination");
const createFavoriteFeedIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.favoriteFeed.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'favoriteFeed not created');
    }
    return result;
});
const getFavoriteFeedListFromDb = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, options = {}) {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    // Build search query
    const searchQuery = options.searchTerm
        ? {
            feed: {
                is: {
                    caption: {
                        contains: options.searchTerm,
                        mode: 'insensitive',
                    },
                },
            },
        }
        : {};
    // Combine all queries
    const whereClause = Object.assign({ userId: userId }, (Object.keys(searchQuery).length > 0 && searchQuery));
    const [result, total] = yield Promise.all([
        prisma_1.default.favoriteFeed.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            select: {
                id: true,
                feedId: true,
                feed: {
                    select: {
                        id: true,
                        caption: true,
                        images: true,
                        user: {
                            select: {
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
                },
            },
        }),
        prisma_1.default.favoriteFeed.count({
            where: whereClause,
        }),
    ]);
    // Flatten the feed object in each result
    const flattenedResult = result.map(item => {
        const { feed } = item, rest = __rest(item, ["feed"]);
        const { user } = feed, feedRest = __rest(feed, ["user"]);
        return Object.assign(Object.assign(Object.assign({}, rest), feedRest), { userId: user.fullName, profileImage: user.image, saloonOwner: user.SaloonOwner && user.SaloonOwner.length > 0
                ? {
                    userId: user.SaloonOwner[0].userId,
                    shopName: user.SaloonOwner[0].shopName,
                    registration: user.SaloonOwner[0].registrationNumber,
                    shopAddress: user.SaloonOwner[0].shopAddress,
                    shopImages: user.SaloonOwner[0].shopImages,
                    shopVideo: user.SaloonOwner[0].shopVideo,
                    shopLogo: user.SaloonOwner[0].shopLogo,
                    avgRating: user.SaloonOwner[0].avgRating,
                    ratingCount: user.SaloonOwner[0].ratingCount,
                }
                : null });
    });
    return (0, pagination_1.formatPaginationResponse)(flattenedResult, total, page, limit);
});
const getFavoriteFeedByIdFromDb = (userId, favoriteFeedId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.favoriteFeed.findUnique({
        where: {
            id: favoriteFeedId,
            userId: userId,
        },
        select: {
            id: true,
            feedId: true,
            feed: true,
        },
    });
    if (!result) {
        return { message: 'FavoriteFeed item not found' };
    }
    return result;
});
const updateFavoriteFeedIntoDb = (userId, favoriteFeedId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.favoriteFeed.update({
        where: {
            id: favoriteFeedId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'favoriteFeedId, not updated');
    }
    return result;
});
const deleteFavoriteFeedItemFromDb = (userId, favoriteFeedId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.favoriteFeed.delete({
        where: {
            id: favoriteFeedId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'favoriteFeedId, not deleted');
    }
    return deletedItem;
});
exports.favoriteFeedService = {
    createFavoriteFeedIntoDb,
    getFavoriteFeedListFromDb,
    getFavoriteFeedByIdFromDb,
    updateFavoriteFeedIntoDb,
    deleteFavoriteFeedItemFromDb,
};
