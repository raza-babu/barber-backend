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
exports.barberScheduleService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createBarberScheduleIntoDb = (saloonOwnerId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { barberId, schedules } = data;
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Schedule data is required');
    }
    // Map for Prisma
    const dataForDb = schedules.map(schedule => ({
        saloonOwnerId,
        barberId: barberId,
        dayName: schedule.dayName,
        dayOfWeek: schedule.dayOfWeek,
        openingDateTime: schedule.openingDateTime,
        closingDateTime: schedule.closingDateTime,
        openingTime: schedule.openingTime,
        closingTime: schedule.closingTime,
        isActive: schedule.isActive,
        type: data.type,
    }));
    // Delete old schedules for this barber first
    yield prisma_1.default.barberSchedule.deleteMany({
        where: { saloonOwnerId, barberId: barberId },
    });
    // Create new schedules
    const result = yield prisma_1.default.barberSchedule.createMany({
        data: dataForDb,
    });
    if (!result || result.count !== schedules.length) {
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to create all barber schedule entries');
    }
    return result;
});
const getBarberScheduleListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barberSchedule.findMany({
        select: {
            id: true,
            saloonOwnerId: true,
            barberId: true,
            dayName: true,
            openingTime: true,
            closingTime: true,
            isActive: true,
            type: true,
            // openingDateTime: true,
            // closingDateTime: true,
        },
    });
    if (result.length === 0) {
        return [];
    }
    return result.map(schedule => ({
        id: schedule.id,
        saloonOwnerId: schedule.saloonOwnerId,
        barberId: schedule.barberId,
        dayName: schedule.dayName,
        time: `${schedule.openingTime} - ${schedule.closingTime}`,
        isActive: schedule.isActive,
        type: schedule.type,
        // openingDateTime: schedule.openingDateTime,
        // closingDateTime: schedule.closingDateTime,
    }));
});
const getBarberScheduleByIdFromDb = (userId, barberScheduleId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barberSchedule.findMany({
        where: {
            barberId: barberScheduleId,
            saloonOwnerId: userId,
        },
        select: {
            id: true,
            saloonOwnerId: true,
            barberId: true,
            dayName: true,
            openingTime: true,
            closingTime: true,
            isActive: true,
            type: true,
            // openingDateTime: true,
            // closingDateTime: true,
        },
    });
    if (!result) {
        return [];
    }
    return result.map(schedule => ({
        id: schedule.id,
        saloonOwnerId: schedule.saloonOwnerId,
        barberId: schedule.barberId,
        dayName: schedule.dayName,
        time: `${schedule.openingTime} - ${schedule.closingTime}`,
        isActive: schedule.isActive,
        type: schedule.type,
        // openingDateTime: schedule.openingDateTime,
        // closingDateTime: schedule.closingDateTime,
    }));
});
const updateBarberScheduleIntoDb = (userId, barberScheduleId, data) => __awaiter(void 0, void 0, void 0, function* () {
    // ensure the schedule exists and belongs to the saloon owner
    const existing = yield prisma_1.default.barberSchedule.findFirst({
        where: {
            id: barberScheduleId,
            saloonOwnerId: userId,
        },
    });
    if (!existing) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barberScheduleId, not found');
    }
    const result = yield prisma_1.default.barberSchedule.update({
        where: { id: barberScheduleId },
        data: Object.assign({}, data),
        select: {
            id: true,
            saloonOwnerId: true,
            barberId: true,
            dayName: true,
            openingTime: true,
            closingTime: true,
            isActive: true,
            type: true
            // openingDateTime: true,
            // closingDateTime: true,
        },
    });
    return {
        id: result.id,
        saloonOwnerId: result.saloonOwnerId,
        barberId: result.barberId,
        dayName: result.dayName,
        time: `${result.openingTime} - ${result.closingTime}`,
        isActive: result.isActive,
        type: result.type,
        // openingDateTime: result.openingDateTime,
        // closingDateTime: result.closingDateTime,
    };
});
const deleteBarberScheduleItemFromDb = (userId, barberId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.barberSchedule.deleteMany({
        where: {
            barberId: barberId,
            saloonOwnerId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barberScheduleId, not deleted');
    }
    return deletedItem;
});
exports.barberScheduleService = {
    createBarberScheduleIntoDb,
    getBarberScheduleListFromDb,
    getBarberScheduleByIdFromDb,
    updateBarberScheduleIntoDb,
    deleteBarberScheduleItemFromDb,
};
