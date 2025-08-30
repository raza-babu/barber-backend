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
const deleteImage_1 = require("../../utils/deleteImage");
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
const updateAdsIntoDb = (userId, adsId, data, existingImages) => __awaiter(void 0, void 0, void 0, function* () {
    const existingAd = yield prisma_1.default.ads.findUnique({
        where: { id: adsId },
    });
    if (!existingAd) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Ads not found");
    }
    // Dates normalization
    if (data.startDate && data.endDate) {
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        if (startDate >= endDate) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Start date must be before end date");
        }
        data.startDate = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000).toISOString();
        data.endDate = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000).toISOString();
    }
    // Final images already prepared in controller
    const finalImages = data.images;
    const updateData = {
        description: data.description,
        images: finalImages,
        startDate: data.startDate,
        endDate: data.endDate,
    };
    const result = yield prisma_1.default.ads.update({
        where: { id: adsId },
        data: updateData,
    });
    // Remove images that are not in final list anymore
    const removedImages = (existingAd.images || []).filter(img => !finalImages.includes(img));
    for (const img of removedImages) {
        yield (0, deleteImage_1.deleteFileFromSpace)(img);
        console.log("Deleted image from space:", img);
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
