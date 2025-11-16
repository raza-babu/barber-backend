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
const luxon_1 = require("luxon");
// Helper to map day name to dayOfWeek (0=Sunday, 1=Monday, ..., 6=Saturday)
const dayNameToIndex = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
};
const createSaloonScheduleIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!data || !Array.isArray(data) || data.length === 0) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Schedule data is required');
    }
    const mappedSchedules = data.map(schedule => {
        const dayOfWeek = dayNameToIndex[schedule.dayName.toLowerCase()];
        if (dayOfWeek === undefined ||
            !schedule.openingTime ||
            !schedule.closingTime ||
            typeof schedule.isActive !== 'boolean') {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid schedule data format');
        }
        const openingDateTime = luxon_1.DateTime.fromFormat(schedule.openingTime, 'hh:mm a', { zone: 'local' }).toUTC().toJSDate();
        const closingDateTime = luxon_1.DateTime.fromFormat(schedule.closingTime, 'hh:mm a', { zone: 'local' }).toUTC().toJSDate();
        return {
            saloonOwnerId: userId,
            dayName: schedule.dayName,
            dayOfWeek,
            openingDateTime,
            closingDateTime,
            openingTime: schedule.openingTime,
            closingTime: schedule.closingTime,
            isActive: schedule.isActive,
        };
    });
    return prisma_1.default.$transaction((transactionClient) => __awaiter(void 0, void 0, void 0, function* () {
        yield transactionClient.saloonSchedule.deleteMany({
            where: { saloonOwnerId: userId },
        });
        const createdSchedules = yield transactionClient.saloonSchedule.createMany({
            data: mappedSchedules,
        });
        if (createdSchedules.count !== mappedSchedules.length) {
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to create all schedule entries');
        }
        return createdSchedules;
    }));
});
const getSaloonScheduleListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    // Get all schedules for the user
    const schedules = yield prisma_1.default.saloonSchedule.findMany({
        where: {
            saloonOwnerId: userId,
        },
        select: {
            id: true,
            saloonOwnerId: true,
            dayName: true,
            openingTime: true,
            closingTime: true,
            isActive: true,
        },
        orderBy: {
            dayOfWeek: 'asc',
        },
    });
    if (schedules.length === 0) {
        return [];
    }
    // Get holidays for the user
    // const holidays = await saloonHolidayService.getSaloonHolidayListFromDb(userId);
    // const holidayDays = holidays.map((h: any) => h.dayOfWeek);
    // // Mark isActive false for holidays in the response (do not change DB)
    // const result = schedules.map(schedule => {
    //   if (holidayDays.includes(schedule.dayOfWeek)) {
    //     return { ...schedule, isActive: false };
    //   }
    //   return schedule;
    // });
    return schedules.map(schedule => ({
        id: schedule.id,
        saloonOwnerId: schedule.saloonOwnerId,
        dayName: schedule.dayName,
        time: `${schedule.openingTime} - ${schedule.closingTime}`,
        isActive: schedule.isActive,
        // openingDateTime: schedule.openingDateTime,
        // closingDateTime: schedule.closingDateTime, 
    }));
});
const getSaloonScheduleByIdFromDb = (userId, saloonScheduleId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonSchedule.findUnique({
        where: {
            id: saloonScheduleId,
            saloonOwnerId: userId,
        },
        select: {
            id: true,
            saloonOwnerId: true,
            dayName: true,
            openingTime: true,
            closingTime: true,
            isActive: true,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'saloonSchedule not found');
    }
    // Format the response to match the list output
    return {
        id: result.id,
        saloonOwnerId: result.saloonOwnerId,
        dayName: result.dayName,
        time: `${result.openingTime} - ${result.closingTime}`,
        isActive: result.isActive,
    };
});
const updateSaloonScheduleIntoDb = (userId, saloonScheduleId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonSchedule.update({
        where: {
            id: saloonScheduleId,
            saloonOwnerId: userId,
        },
        data: Object.assign({}, data),
        select: {
            id: true,
            saloonOwnerId: true,
            dayName: true,
            openingTime: true,
            closingTime: true,
            isActive: true,
        },
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
