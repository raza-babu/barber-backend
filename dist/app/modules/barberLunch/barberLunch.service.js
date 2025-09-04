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
exports.barberLunchService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const luxon_1 = require("luxon");
const createBarberLunchIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { barberId, date, startTime, endTime } = data;
    const baseDate = luxon_1.DateTime.fromISO(date, { zone: 'local' });
    if (!baseDate.isValid) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid date format');
    }
    const parseClockToUTC = (timeStr) => {
        const [time, modifier] = timeStr.trim().split(' ');
        let [h, m] = time.split(':').map(Number);
        if ((modifier === null || modifier === void 0 ? void 0 : modifier.toUpperCase()) === 'PM' && h !== 12)
            h += 12;
        if ((modifier === null || modifier === void 0 ? void 0 : modifier.toUpperCase()) === 'AM' && h === 12)
            h = 0;
        return baseDate
            .set({ hour: h, minute: m, second: 0, millisecond: 0 })
            .toUTC();
    };
    const lunchStartDt = parseClockToUTC(startTime);
    const lunchEndDt = parseClockToUTC(endTime);
    if (!(lunchStartDt < lunchEndDt)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Lunch start must be before end');
    }
    const dayStartUTC = baseDate.startOf('day').toUTC();
    const dayEndUTC = baseDate.endOf('day').toUTC();
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const dayName = baseDate.toFormat('cccc');
        const schedule = yield tx.barberSchedule.findFirst({
            where: {
                saloonOwnerId: userId,
                barberId,
                dayName: dayName.toLowerCase(),
                isActive: true,
            },
        });
        if (!schedule) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber is off on this date');
        }
        const opening = schedule.openingDateTime instanceof Date
            ? luxon_1.DateTime.fromJSDate(schedule.openingDateTime).setZone('local')
            : luxon_1.DateTime.fromISO(String(schedule.openingDateTime), { zone: 'local' });
        const closing = schedule.closingDateTime instanceof Date
            ? luxon_1.DateTime.fromJSDate(schedule.closingDateTime).setZone('local')
            : luxon_1.DateTime.fromISO(String(schedule.closingDateTime), { zone: 'local' });
        const workStart = baseDate
            .set({ hour: opening.hour, minute: opening.minute })
            .toUTC();
        const workEnd = baseDate
            .set({ hour: closing.hour, minute: closing.minute })
            .toUTC();
        if (lunchStartDt < workStart || lunchEndDt > workEnd) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Lunch must be within working hours');
        }
        const overlappingLunch = yield tx.barberLunch.findFirst({
            where: {
                barberId,
                lunchStart: { lt: lunchEndDt.toJSDate() },
                lunchEnd: { gt: lunchStartDt.toJSDate() },
            },
        });
        if (overlappingLunch) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Lunch already exists in this period');
        }
        const now = luxon_1.DateTime.local().toUTC();
        // 🚫 Block if lunch intersects with an ongoing status
        const activeStatus = yield tx.barberRealTimeStatus.findFirst({
            where: {
                barberId,
                startDateTime: { lte: now.toJSDate() },
                endDateTime: { gt: now.toJSDate() },
                AND: [
                    { startDateTime: { lt: lunchEndDt.toJSDate() } },
                    { endDateTime: { gt: lunchStartDt.toJSDate() } },
                ],
            },
        });
        if (activeStatus) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Lunch overlaps an ongoing status. Pick another time.');
        }
        // 🚫 Block if lunch intersects with an ongoing slot
        const activeSlot = yield tx.queueSlot.findFirst({
            where: {
                barberId,
                startedAt: { lte: now.toJSDate() },
                completedAt: { gt: now.toJSDate() },
                AND: [
                    { startedAt: { lt: lunchEndDt.toJSDate() } },
                    { completedAt: { gt: lunchStartDt.toJSDate() } },
                ],
            },
        });
        if (activeSlot) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Lunch overlaps an ongoing slot. Pick another time.');
        }
        // ✅ Create lunch record
        const lunch = yield tx.barberLunch.create({
            data: {
                barberId,
                saloonOwnerId: userId,
                lunchStart: lunchStartDt.toJSDate(),
                lunchEnd: lunchEndDt.toJSDate(),
                startTime,
                endTime,
            },
        });
        // ⏸ Insert explicit On Break status
        const realTime = yield tx.barberRealTimeStatus.create({
            data: {
                barberId,
                isAvailable: false,
                startDateTime: lunch.lunchStart,
                endDateTime: lunch.lunchEnd,
                startTime: lunch.startTime,
                endTime: lunch.endTime,
            },
        });
        if (realTime.startDateTime.getTime() !== lunch.lunchStart.getTime() ||
            realTime.endDateTime.getTime() !== lunch.lunchEnd.getTime()) {
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to create real-time status for lunch');
        }
        // 🔁 Reschedule future RealTimeStatuses
        const statuses = yield tx.barberRealTimeStatus.findMany({
            where: {
                barberId,
                startDateTime: {
                    gt: now.toJSDate(), // greater than now
                    lt: dayEndUTC.toJSDate(), // less than end of day
                },
            },
            orderBy: { startDateTime: 'asc' },
        });
        let nextStart = lunchEndDt;
        let skipReschedule = false;
        for (const st of statuses) {
            // ⛔ Skip the lunch record itself
            if (st.startDateTime.getTime() === lunch.lunchStart.getTime() &&
                st.endDateTime.getTime() === lunch.lunchEnd.getTime()) {
                continue;
            }
            const sStart = luxon_1.DateTime.fromJSDate(st.startDateTime).toUTC();
            const sEnd = luxon_1.DateTime.fromJSDate(st.endDateTime).toUTC();
            if (sEnd <= lunchStartDt)
                continue;
            if (sStart >= lunchEndDt && (nextStart === null || nextStart === void 0 ? void 0 : nextStart.equals(lunchEndDt))) {
                skipReschedule = true;
                continue;
            }
            const duration = sEnd.diff(sStart, 'minutes').as('minutes');
            const newStart = nextStart;
            const newEnd = newStart.plus({ minutes: duration });
            yield tx.barberRealTimeStatus.update({
                where: { id: st.id },
                data: {
                    startDateTime: newStart.toJSDate(),
                    endDateTime: newEnd.toJSDate(),
                    startTime: newStart.setZone('local').toFormat('hh:mm a'),
                    endTime: newEnd.setZone('local').toFormat('hh:mm a'),
                },
            });
            nextStart = newEnd;
        }
        // 🔁 Reschedule future QueueSlots
        const slots = yield tx.queueSlot.findMany({
            where: {
                barberId,
                startedAt: {
                    gt: now.toJSDate(), // after now
                    lt: dayEndUTC.toJSDate(), // before end of the day
                },
            },
            orderBy: { startedAt: 'asc' },
        });
        nextStart = lunchEndDt;
        let skipSlotReschedule = false;
        for (const slot of slots) {
            if (!slot.startedAt || !slot.completedAt)
                continue;
            const slotStart = luxon_1.DateTime.fromJSDate(slot.startedAt).toUTC();
            const slotEnd = luxon_1.DateTime.fromJSDate(slot.completedAt).toUTC();
            if (slotEnd <= lunchStartDt)
                continue;
            if (slotStart >= lunchEndDt && nextStart.equals(lunchEndDt)) {
                skipSlotReschedule = true; // first one after lunch untouched
                continue;
            }
            if (skipSlotReschedule)
                continue;
            const duration = slotEnd.diff(slotStart, 'minutes').as('minutes');
            const newStart = nextStart;
            const newEnd = newStart.plus({ minutes: duration });
            yield tx.queueSlot.update({
                where: { id: slot.id },
                data: {
                    startedAt: newStart.toJSDate(),
                    completedAt: newEnd.toJSDate(),
                },
            });
            if (slot.bookingId) {
                yield tx.booking.update({
                    where: { id: slot.bookingId },
                    data: {
                        startDateTime: newStart.toJSDate(),
                        endDateTime: newEnd.toJSDate(),
                        startTime: newStart.setZone('local').toFormat('hh:mm a'),
                        endTime: newEnd.setZone('local').toFormat('hh:mm a'),
                    },
                });
            }
            nextStart = newEnd;
        }
        return lunch;
    }));
});
const getBarberLunchListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barberLunch.findMany({
        where: {
            saloonOwnerId: userId,
        },
        orderBy: {
            lunchStart: 'asc',
        },
        select: {
            id: true,
            barberId: true,
            saloonOwnerId: true,
            lunchStart: true,
            lunchEnd: true,
            startTime: true,
            endTime: true,
            barber: {
                select: {
                    user: {
                        select: {
                            fullName: true,
                            image: true,
                            email: true,
                            phoneNumber: true,
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
        barberName: item.barber.user.fullName,
        barberImage: item.barber.user.image,
        barberEmail: item.barber.user.email,
        barberPhone: item.barber.user.phoneNumber,
        barberId: item.barberId,
        lunchStart: luxon_1.DateTime.fromJSDate(item.lunchStart).toUTC().toISO(),
        lunchEnd: luxon_1.DateTime.fromJSDate(item.lunchEnd).toUTC().toISO(),
        startTime: luxon_1.DateTime.fromJSDate(item.lunchStart).setZone('local').toFormat('hh:mm a'),
        endTime: luxon_1.DateTime.fromJSDate(item.lunchEnd).setZone('local').toFormat('hh:mm a'),
    }));
});
const getBarberLunchByIdFromDb = (userId, barberLunchId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barberLunch.findFirst({
        where: {
            barberId: barberLunchId,
            saloonOwnerId: userId,
        },
        select: {
            id: true,
            barberId: true,
            saloonOwnerId: true,
            lunchStart: true,
            lunchEnd: true,
            startTime: true,
            endTime: true,
            barber: {
                select: {
                    user: {
                        select: {
                            fullName: true,
                            image: true,
                            email: true,
                            phoneNumber: true,
                        },
                    },
                },
            },
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'barberLunch not found');
    }
    return {
        id: result.id,
        barberId: result.barberId,
        saloonOwnerId: result.saloonOwnerId,
        barberName: result.barber.user.fullName,
        barberImage: result.barber.user.image,
        barberEmail: result.barber.user.email,
        barberPhone: result.barber.user.phoneNumber,
        lunchStart: luxon_1.DateTime.fromJSDate(result.lunchStart).toUTC().toISO(),
        lunchEnd: luxon_1.DateTime.fromJSDate(result.lunchEnd).toUTC().toISO(),
        startTime: luxon_1.DateTime.fromJSDate(result.lunchStart).setZone('local').toFormat('hh:mm a'),
        endTime: luxon_1.DateTime.fromJSDate(result.lunchEnd).setZone('local').toFormat('hh:mm a'),
    };
});
const updateBarberLunchIntoDb = (userId, barberLunchId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barberLunch.update({
        where: {
            id: barberLunchId,
            saloonOwnerId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barberLunchId, not updated');
    }
    return result;
});
const deleteBarberLunchItemFromDb = (userId, barberLunchId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.barberLunch.delete({
        where: {
            id: barberLunchId,
            saloonOwnerId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barberLunchId, not deleted');
    }
    return deletedItem;
});
exports.barberLunchService = {
    createBarberLunchIntoDb,
    getBarberLunchListFromDb,
    getBarberLunchByIdFromDb,
    updateBarberLunchIntoDb,
    deleteBarberLunchItemFromDb,
};
