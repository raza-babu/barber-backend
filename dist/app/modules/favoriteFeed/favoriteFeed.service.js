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
exports.favoriteFeedService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createFavoriteFeedIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.favoriteFeed.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'favoriteFeed not created');
    }
    return result;
});
const getFavoriteFeedListFromDb = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.favoriteFeed.findMany();
    if (result.length === 0) {
        return [];
    }
    return result;
});
const getFavoriteFeedByIdFromDb = (favoriteFeedId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.favoriteFeed.findUnique({
        where: {
            id: favoriteFeedId,
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
