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
exports.lunchService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createLunchIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { startTime, endTime, status = true } = data;
    // Parse "hh:mm AM/PM" → 24-hour
    function parseTimeTo24Hour(timeStr) {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours < 12)
            hours += 12;
        if (modifier === 'AM' && hours === 12)
            hours = 0;
        return { hours, minutes };
    }
    const { hours: startHours, minutes: startMinutes } = parseTimeTo24Hour(startTime);
    const { hours: endHours, minutes: endMinutes } = parseTimeTo24Hour(endTime);
    // Force into ISO format to avoid "Invalid Date"
    const isoDate = new Date().toISOString(); // e.g., "2025-08-20"
    const startedAt = new Date(isoDate);
    startedAt.setUTCHours(startHours, startMinutes, 0, 0);
    const completedAt = new Date(isoDate);
    completedAt.setUTCHours(endHours, endMinutes, 0, 0);
    const result = yield prisma_1.default.lunch.create({
        data: {
            saloonOwnerId: userId,
            startedAt,
            completedAt,
            startTime,
            endTime,
            status,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'lunch not created');
    }
    return result;
});
const getLunchListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.lunch.findMany({
        where: {
            saloonOwnerId: userId,
            status: true,
        },
    });
    if (result.length === 0) {
        return [];
    }
    return result;
});
const getLunchByIdFromDb = (userId, lunchId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.lunch.findUnique({
        where: {
            id: lunchId,
            saloonOwnerId: userId,
            status: true,
        },
    });
    if (!result) {
        return { message: 'Lunch not found' };
    }
    return result;
});
const updateLunchIntoDb = (userId, lunchId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { startTime, endTime, status = true } = data;
    // Parse "hh:mm AM/PM" → 24-hour
    function parseTimeTo24Hour(timeStr) {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours < 12)
            hours += 12;
        if (modifier === 'AM' && hours === 12)
            hours = 0;
        return { hours, minutes };
    }
    const { hours: startHours, minutes: startMinutes } = parseTimeTo24Hour(startTime);
    const { hours: endHours, minutes: endMinutes } = parseTimeTo24Hour(endTime);
    // Force into ISO format to avoid "Invalid Date"
    const isoDate = new Date().toISOString();
    const startedAt = new Date(isoDate);
    startedAt.setUTCHours(startHours, startMinutes, 0, 0);
    const completedAt = new Date(isoDate);
    completedAt.setUTCHours(endHours, endMinutes, 0, 0);
    const updateData = {
        startTime,
        endTime,
        startedAt,
        completedAt,
        status,
    };
    const result = yield prisma_1.default.lunch.update({
        where: {
            id: lunchId,
            saloonOwnerId: userId,
        },
        data: updateData,
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'lunchId, not updated');
    }
    return result;
});
const deleteLunchItemFromDb = (userId, lunchId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.lunch.delete({
        where: {
            id: lunchId,
            saloonOwnerId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'lunchId, not deleted');
    }
    return deletedItem;
});
exports.lunchService = {
    createLunchIntoDb,
    getLunchListFromDb,
    getLunchByIdFromDb,
    updateLunchIntoDb,
    deleteLunchItemFromDb,
};
