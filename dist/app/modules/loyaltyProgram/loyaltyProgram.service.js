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
exports.loyaltyProgramService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createLoyaltyProgramIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const findService = yield prisma_1.default.service.findUnique({
        where: {
            id: data.serviceId,
            saloonOwnerId: userId,
        },
    });
    if (!findService) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Service not found');
    }
    const existingScheme = yield prisma_1.default.loyaltyProgram.findUnique({
        where: {
            serviceId: data.serviceId,
        },
    });
    if (existingScheme) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Loyalty program for this service already exists to this service');
    }
    const result = yield prisma_1.default.loyaltyProgram.create({
        data: Object.assign(Object.assign({}, data), { serviceName: findService.serviceName, userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'loyaltyProgram not created');
    }
    return result;
});
const getLoyaltyProgramListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.loyaltyProgram.findMany({
        where: {
            userId: userId,
        },
    });
    if (result.length === 0) {
        return { message: 'No loyaltyProgram found' };
    }
    return result;
});
const getLoyaltyProgramByIdFromDb = (userId, loyaltyProgramId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.loyaltyProgram.findUnique({
        where: {
            id: loyaltyProgramId,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'loyaltyProgram not found');
    }
    return result;
});
const updateLoyaltyProgramIntoDb = (userId, loyaltyProgramId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const findService = yield prisma_1.default.service.findUnique({
        where: {
            id: data.serviceId,
            saloonOwnerId: userId,
        },
    });
    if (!findService) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Service not found');
    }
    const result = yield prisma_1.default.loyaltyProgram.update({
        where: {
            id: loyaltyProgramId,
            userId: userId,
        },
        data: Object.assign(Object.assign({}, data), { serviceName: findService.serviceName }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'loyaltyProgramId, not updated');
    }
    return result;
});
const deleteLoyaltyProgramItemFromDb = (userId, loyaltyProgramId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.loyaltyProgram.delete({
        where: {
            id: loyaltyProgramId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'loyaltyProgramId, not deleted');
    }
    return deletedItem;
});
exports.loyaltyProgramService = {
    createLoyaltyProgramIntoDb,
    getLoyaltyProgramListFromDb,
    getLoyaltyProgramByIdFromDb,
    updateLoyaltyProgramIntoDb,
    deleteLoyaltyProgramItemFromDb,
};
