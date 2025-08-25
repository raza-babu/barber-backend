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
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    // Convert to UTC by adjusting for local timezone offset
    const startDateUtc = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000);
    const endDateUtc = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000);
    data.startDate = startDateUtc.toISOString();
    data.endDate = endDateUtc.toISOString();
    if (startDate >= endDate) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Start date must be before end date');
    }
    const durationMs = endDateUtc.getTime() - startDateUtc.getTime();
    const durationDays = durationMs / (1000 * 60 * 60 * 24);
    data.duration = `${durationDays.toString()} days`;
    const result = yield prisma_1.default.ads.create({
        data: Object.assign(Object.assign({}, data), { userId: userId, startDate: data.startDate, endDate: data.endDate }),
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
    const existingAd = yield prisma_1.default.ads.findUnique({
        where: {
            id: adsId,
        },
    });
    if (!existingAd) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Ads not found');
    }
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    // Convert to UTC by adjusting for local timezone offset
    if (data.startDate && data.endDate) {
        const startDateUtc = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000);
        const endDateUtc = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000);
        data.startDate = startDateUtc.toISOString();
        data.endDate = endDateUtc.toISOString();
        if (startDate >= endDate) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Start date must be before end date');
        }
    }
    // Only include fields that are present in the data object
    const updateData = {};
    if (data.description !== undefined)
        updateData.description = data.description;
    if (data.images !== undefined)
        updateData.images = data.images;
    if (data.startDate !== undefined)
        updateData.startDate = data.startDate;
    if (data.endDate !== undefined)
        updateData.endDate = data.endDate;
    if (data.duration !== undefined)
        updateData.duration = data.duration;
    const result = yield prisma_1.default.ads.update({
        where: {
            id: adsId,
            // userId: userId,
        },
        data: updateData,
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
