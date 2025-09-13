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
exports.loyaltySchemeService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createLoyaltySchemeIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const existingScheme = yield prisma_1.default.loyaltyScheme.findFirst({
        where: {
            userId: userId,
            pointThreshold: data.pointThreshold,
            percentage: data.percentage,
        },
    });
    if (existingScheme) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'A loyalty scheme with the same point threshold and percentage already exists.');
    }
    const result = yield prisma_1.default.loyaltyScheme.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'loyaltyScheme not created');
    }
    return result;
});
const getLoyaltySchemeListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.loyaltyScheme.findMany({
        where: {
            userId: userId,
        },
    });
    if (result.length === 0) {
        return { message: 'No loyaltyScheme found' };
    }
    return result;
});
const getLoyaltySchemeByIdFromDb = (userId, loyaltySchemeId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.loyaltyScheme.findUnique({
        where: {
            userId: userId,
            id: loyaltySchemeId,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'loyaltyScheme not found');
    }
    return result;
});
const updateLoyaltySchemeIntoDb = (userId, loyaltySchemeId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.loyaltyScheme.update({
        where: {
            id: loyaltySchemeId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'loyaltySchemeId, not updated');
    }
    return result;
});
const deleteLoyaltySchemeItemFromDb = (userId, loyaltySchemeId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.loyaltyScheme.delete({
        where: {
            id: loyaltySchemeId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'loyaltySchemeId, not deleted');
    }
    return deletedItem;
});
exports.loyaltySchemeService = {
    createLoyaltySchemeIntoDb,
    getLoyaltySchemeListFromDb,
    getLoyaltySchemeByIdFromDb,
    updateLoyaltySchemeIntoDb,
    deleteLoyaltySchemeItemFromDb,
};
