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
exports.queueCapacityService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createQueueCapacityIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.queueCapacity.create({
        data: Object.assign(Object.assign({}, data), { saloonOwnerId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'queueCapacity not created');
    }
    return result;
});
const getQueueCapacityListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.queueCapacity.findMany({
        where: {
            saloonOwnerId: userId,
        },
        select: {
            id: true,
            barberId: true,
            maxCapacity: true,
            barber: {
                select: {
                    user: {
                        select: {
                            fullName: true,
                            image: true,
                        },
                    },
                },
            },
        },
    });
    if (result.length === 0) {
        return [];
    }
    return result.map(item => ({
        id: item.id,
        barberId: item.barberId,
        maxCapacity: item.maxCapacity,
        barberName: item.barber.user.fullName,
        image: item.barber.user.image,
    }));
});
const getQueueCapacityByIdFromDb = (userId, queueCapacityId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.queueCapacity.findUnique({
        where: {
            id: queueCapacityId,
            saloonOwnerId: userId,
        },
        select: {
            id: true,
            barberId: true,
            maxCapacity: true,
            barber: {
                select: {
                    user: {
                        select: {
                            fullName: true,
                            image: true,
                        },
                    },
                },
            },
        },
    });
    if (!result) {
        return { message: 'Queue capacity not found' };
    }
    return {
        id: result.id,
        barberId: result.barberId,
        maxCapacity: result.maxCapacity,
        barberName: result.barber.user.fullName,
        image: result.barber.user.image,
    };
});
const updateQueueCapacityIntoDb = (userId, queueCapacityId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.queueCapacity.update({
        where: {
            id: queueCapacityId,
            saloonOwnerId: userId,
        },
        data: Object.assign({}, data),
        select: {
            id: true,
            barberId: true,
            maxCapacity: true,
            barber: {
                select: {
                    user: {
                        select: {
                            fullName: true,
                            image: true,
                        },
                    },
                },
            },
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'queueCapacityId, not updated');
    }
    return {
        id: result.id,
        barberId: result.barberId,
        maxCapacity: result.maxCapacity,
        barberName: result.barber.user.fullName,
        image: result.barber.user.image,
    };
});
const deleteQueueCapacityItemFromDb = (userId, queueCapacityId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.queueCapacity.delete({
        where: {
            id: queueCapacityId,
            saloonOwnerId: userId,
        },
        select: {
            id: true,
            barberId: true,
            maxCapacity: true,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'queueCapacityId, not deleted');
    }
    return deletedItem;
});
exports.queueCapacityService = {
    createQueueCapacityIntoDb,
    getQueueCapacityListFromDb,
    getQueueCapacityByIdFromDb,
    updateQueueCapacityIntoDb,
    deleteQueueCapacityItemFromDb,
};
