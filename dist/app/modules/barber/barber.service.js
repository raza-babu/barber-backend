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
exports.barberService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createBarberIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barber.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barber not created');
    }
    return result;
});
const getBarberListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barber.findMany();
    if (result.length === 0) {
        return { message: 'No barber found' };
    }
    return result;
});
const getBarberByIdFromDb = (userId, barberId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barber.findUnique({
        where: {
            userId: barberId,
        },
        include: {
            user: {
                select: {
                    fullName: true,
                    email: true,
                    phoneNumber: true,
                    image: true,
                }
            }
        }
    });
    // check following or not
    const isFollowing = yield prisma_1.default.follow.findFirst({
        where: {
            userId: userId,
            followingId: barberId,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'barber not found');
    }
    return Object.assign(Object.assign({}, result), { isFollowing: isFollowing ? true : false });
});
const updateBarberIntoDb = (userId, barberId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barber.update({
        where: {
            id: barberId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barberId, not updated');
    }
    return result;
});
const deleteBarberItemFromDb = (userId, barberId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.barber.delete({
        where: {
            id: barberId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barberId, not deleted');
    }
    return deletedItem;
});
exports.barberService = {
    createBarberIntoDb,
    getBarberListFromDb,
    getBarberByIdFromDb,
    updateBarberIntoDb,
    deleteBarberItemFromDb,
};
