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
exports.adsService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createAdsIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.ads.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'ads not created');
    }
    return result;
});
const getAdsListFromDb = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.ads.findMany();
    if (result.length === 0) {
        return [];
    }
    return result;
});
const getAdsByIdFromDb = (adsId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.ads.findUnique({
        where: {
            id: adsId,
        },
    });
    if (!result) {
        return { message: 'Ads not found' };
    }
    return result;
});
const updateAdsIntoDb = (userId, adsId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.ads.update({
        where: {
            id: adsId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'adsId, not updated');
    }
    return result;
});
const deleteAdsItemFromDb = (userId, adsId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.ads.delete({
        where: {
            id: adsId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'adsId, not deleted');
    }
    return deletedItem;
});
exports.adsService = {
    createAdsIntoDb,
    getAdsListFromDb,
    getAdsByIdFromDb,
    updateAdsIntoDb,
    deleteAdsItemFromDb,
};
