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
exports.saloonHolidayService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createSaloonHolidayIntoDb = (userId, 
//  saloonId: string, 
data) => __awaiter(void 0, void 0, void 0, function* () {
    // Check if saloon exists and belongs to user
    const saloon = yield prisma_1.default.saloonOwner.findUnique({
        where: {
            // id: saloonId,
            userId: userId
        }
    });
    if (!saloon) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Saloon not found or not owned by user');
    }
    // Check for duplicate holidays
    const existingHoliday = yield prisma_1.default.saloonHoliday.findFirst({
        where: {
            // saloonId,
            userId,
            date: data.date
        }
    });
    if (existingHoliday) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, 'Holiday already exists for this date');
    }
    return yield prisma_1.default.saloonHoliday.create({
        data: Object.assign(Object.assign({}, data), { userId })
    });
});
const getSaloonHolidayListFromDb = (saloonId_1, ...args_1) => __awaiter(void 0, [saloonId_1, ...args_1], void 0, function* (saloonId, filters = {}) {
    const where = { saloonId };
    if (filters.fromDate || filters.toDate) {
        where.date = {
            gte: filters.fromDate,
            lte: filters.toDate
        };
    }
    if (filters.isRecurring !== undefined) {
        where.isRecurring = filters.isRecurring;
    }
    return yield prisma_1.default.saloonHoliday.findMany({
        where,
        orderBy: { date: 'asc' }
    });
});
const getSaloonHolidayByIdFromDb = (userId, holidayId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonHoliday.findUnique({
        where: {
            id: holidayId,
            userId
        }
    });
    if (!result) {
        return { message: 'Holiday not found or not owned by user' };
    }
    return result;
});
const updateSaloonHolidayIntoDb = (userId, 
// saloonId: string,
holidayId, data) => __awaiter(void 0, void 0, void 0, function* () {
    // Verify ownership
    const holiday = yield prisma_1.default.saloonHoliday.findFirst({
        where: {
            id: holidayId,
            // saloonId,
            userId
        }
    });
    if (!holiday) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Holiday not found or not owned by user');
    }
    return yield prisma_1.default.saloonHoliday.update({
        where: { id: holidayId },
        data
    });
});
const deleteSaloonHolidayItemFromDb = (userId, 
// saloonId: string,
holidayId) => __awaiter(void 0, void 0, void 0, function* () {
    // Verify ownership before deletion
    const holiday = yield prisma_1.default.saloonHoliday.findFirst({
        where: {
            id: holidayId,
            // saloonId,
            userId
        }
    });
    if (!holiday) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Holiday not found or not owned by user');
    }
    return yield prisma_1.default.saloonHoliday.delete({
        where: { id: holidayId }
    });
});
// Additional utility function
const checkSaloonHolidayFromDb = (saloonId, date) => __awaiter(void 0, void 0, void 0, function* () {
    // Check specific date
    const specificHoliday = yield prisma_1.default.saloonHoliday.findFirst({
        where: {
            saloonId,
            date: {
                equals: date
            }
        }
    });
    if (specificHoliday)
        return specificHoliday;
    // Check recurring holidays (same month/day)
    const recurringHolidays = yield prisma_1.default.saloonHoliday.findMany({
        where: {
            saloonId,
            isRecurring: true
        }
    });
    return recurringHolidays.find(h => {
        const hDate = new Date(h.date);
        return hDate.getMonth() === date.getMonth() &&
            hDate.getDate() === date.getDate();
    });
});
exports.saloonHolidayService = {
    createSaloonHolidayIntoDb,
    getSaloonHolidayListFromDb,
    getSaloonHolidayByIdFromDb,
    updateSaloonHolidayIntoDb,
    deleteSaloonHolidayItemFromDb,
    checkSaloonHolidayFromDb
};
