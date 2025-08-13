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
exports.saloonScheduleService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createSaloonScheduleIntoDb = (userId, schedules) => __awaiter(void 0, void 0, void 0, function* () {
    // Validate input data
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Schedule data is required');
    }
    // Validate each schedule entry
    schedules.forEach(schedule => {
        if (schedule.dayOfWeek < 0 ||
            schedule.dayOfWeek > 6 ||
            !schedule.openingTime ||
            !schedule.closingTime ||
            typeof schedule.isActive !== 'boolean') {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid schedule data format');
        }
    });
    // Use transaction to ensure atomic operation
    return yield prisma_1.default.$transaction((transactionClient) => __awaiter(void 0, void 0, void 0, function* () {
        // First delete existing schedules for this saloon
        yield transactionClient.saloonSchedule.deleteMany({
            where: { saloonOwnerId: userId },
        });
        // Create new schedules
        const createdSchedules = yield transactionClient.saloonSchedule.createMany({
            data: schedules.map(schedule => ({
                saloonOwnerId: userId,
                dayOfWeek: schedule.dayOfWeek,
                openingTime: schedule.openingTime,
                closingTime: schedule.closingTime,
                isActive: schedule.isActive,
            })),
        });
        if (!createdSchedules || createdSchedules.count !== schedules.length) {
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to create all schedule entries');
        }
        return createdSchedules;
    }));
});
const getSaloonScheduleListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonSchedule.findMany({
        where: {
            saloonOwnerId: userId,
        },
    });
    if (result.length === 0) {
        return [];
    }
    return result;
});
const getSaloonScheduleByIdFromDb = (userId, saloonScheduleId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonSchedule.findUnique({
        where: {
            id: saloonScheduleId,
            saloonOwnerId: userId,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'saloonSchedule not found');
    }
    return result;
});
const updateSaloonScheduleIntoDb = (userId, saloonScheduleId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonSchedule.update({
        where: {
            id: saloonScheduleId,
            saloonOwnerId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'saloonScheduleId, not updated');
    }
    return result;
});
const deleteSaloonScheduleItemFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.saloonSchedule.deleteMany({
        where: {
            saloonOwnerId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'saloonScheduleId, not deleted');
    }
    return deletedItem;
});
exports.saloonScheduleService = {
    createSaloonScheduleIntoDb,
    getSaloonScheduleListFromDb,
    getSaloonScheduleByIdFromDb,
    updateSaloonScheduleIntoDb,
    deleteSaloonScheduleItemFromDb,
};
