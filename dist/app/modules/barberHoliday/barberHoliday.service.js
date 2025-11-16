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
exports.barberHolidayService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createBarberHolidayIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barberDayOff.create({
        data: Object.assign(Object.assign({}, data), { saloonOwnerId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barberHoliday not created');
    }
    return result;
});
const getBarberHolidayListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barberDayOff.findMany({
        select: {
            id: true,
            barberId: true,
            date: true,
            reason: true,
            isAllDay: true,
        },
    });
    if (result.length === 0) {
        return {};
    }
    return result;
});
const getBarberHolidayByIdFromDb = (userId, barberHolidayId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barberDayOff.findMany({
        where: {
            barberId: barberHolidayId,
            saloonOwnerId: userId,
        },
        select: {
            id: true,
            barberId: true,
            date: true,
            reason: true,
            isAllDay: true,
        },
    });
    if (!result) {
        return { message: 'Barber Holidays not found' };
    }
    return result;
});
const updateBarberHolidayIntoDb = (userId, barberHolidayId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barberDayOff.update({
        where: {
            id: barberHolidayId,
            saloonOwnerId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barberHolidayId, not updated');
    }
    return result;
});
const deleteBarberHolidayItemFromDb = (userId, barberHolidayId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.barberDayOff.delete({
        where: {
            id: barberHolidayId,
            saloonOwnerId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barberHolidayId, not deleted');
    }
    return deletedItem;
});
exports.barberHolidayService = {
    createBarberHolidayIntoDb,
    getBarberHolidayListFromDb,
    getBarberHolidayByIdFromDb,
    updateBarberHolidayIntoDb,
    deleteBarberHolidayItemFromDb,
};
