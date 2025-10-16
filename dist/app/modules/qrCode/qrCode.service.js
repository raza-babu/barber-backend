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
exports.qrCodeService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createQrCodeIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const existingQrCode = yield prisma_1.default.qrCode.findFirst({
        where: {
            code: data.code,
            saloonOwnerId: userId,
        },
    });
    if (existingQrCode) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'QR Code already exists');
    }
    const result = yield prisma_1.default.qrCode.create({
        data: Object.assign(Object.assign({}, data), { saloonOwnerId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'qrCode not created');
    }
    return result;
});
const getQrCodeListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.qrCode.findMany({
        where: {
            saloonOwnerId: userId,
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
const verifyQrCodeInDb = (code) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.qrCode.findUnique({
        where: {
            code: code,
        },
    });
    if (!result) {
        return { message: 'QR Code is invalid' };
    }
    return result;
});
const getQrCodeByIdFromDb = (userId, qrCodeId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.qrCode.findUnique({
        where: {
            id: qrCodeId,
            saloonOwnerId: userId,
        },
    });
    if (!result) {
        return { message: 'QR Code not found' };
    }
    return result;
});
const updateQrCodeIntoDb = (userId, qrCodeId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.qrCode.update({
        where: {
            id: qrCodeId,
            saloonOwnerId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'qrCodeId, not updated');
    }
    return result;
});
const deleteQrCodeItemFromDb = (userId, qrCodeId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.qrCode.delete({
        where: {
            id: qrCodeId,
            saloonOwnerId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'qrCodeId, not deleted');
    }
    return deletedItem;
});
exports.qrCodeService = {
    createQrCodeIntoDb,
    getQrCodeListFromDb,
    verifyQrCodeInDb,
    getQrCodeByIdFromDb,
    updateQrCodeIntoDb,
    deleteQrCodeItemFromDb,
};
