"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.barberScheduleValidation = void 0;
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const customParseFormat_1 = __importDefault(require("dayjs/plugin/customParseFormat"));
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(customParseFormat_1.default);
// Map day names to dayOfWeek numbers
const daysMap = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
};
// Regex to validate 12-hour time range
const timeRange12hRegex = /^((0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM))\s*-\s*((0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM))$/i;
// Convert 12h time to UTC Date object
function convertToUTC(timeRange) {
    const [opening, closing] = timeRange.split('-').map(t => t.trim());
    const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
    const openingUTC = (0, dayjs_1.default)(`${today} ${opening}`, 'YYYY-MM-DD hh:mm A')
        .utc()
        .toDate();
    const closingUTC = (0, dayjs_1.default)(`${today} ${closing}`, 'YYYY-MM-DD hh:mm A')
        .utc()
        .toDate();
    const openingTime = (0, dayjs_1.default)(`${today} ${opening}`, 'YYYY-MM-DD hh:mm A').format('hh:mm A');
    const closingTime = (0, dayjs_1.default)(`${today} ${closing}`, 'YYYY-MM-DD hh:mm A').format('hh:mm A');
    return { openingUTC, closingUTC, openingTime, closingTime };
}
// Single schedule validation & transformation
const singleBarberScheduleBaseSchema = zod_1.z.object({
    dayName: zod_1.z
        .string()
        .min(1, 'Day name is required')
        .refine(val => daysMap[val.toLowerCase()] !== undefined, 'Invalid day name'),
    time: zod_1.z
        .string()
        .regex(timeRange12hRegex, 'Time must be in format "hh:mm AM - hh:mm PM"'),
    isActive: zod_1.z.boolean(),
});
const singleBarberScheduleSchema = singleBarberScheduleBaseSchema.transform(data => {
    const { openingUTC, closingUTC, openingTime, closingTime } = convertToUTC(data.time);
    return {
        dayName: data.dayName,
        dayOfWeek: daysMap[data.dayName.toLowerCase()],
        openingDateTime: openingUTC,
        closingDateTime: closingUTC,
        openingTime,
        closingTime,
        isActive: data.isActive,
    };
});
// Main schema for Postman input
const createBarberScheduleSchema = zod_1.z.object({
    body: zod_1.z.object({
        barberId: zod_1.z.string({
            required_error: 'Barber ID is required!',
        }),
        schedules: zod_1.z
            .array(singleBarberScheduleSchema)
            .length(7, 'Exactly 7 days of schedule are required')
            .refine(days => {
            const names = days.map(d => d.dayName.toLowerCase());
            return new Set(names).size === 7;
        }, 'Must have all days of the week'),
    }),
});
// Schema for updating a single day
const updateBarberScheduleSchema = zod_1.z.object({
    body: singleBarberScheduleBaseSchema.partial(),
});
exports.barberScheduleValidation = {
    createBarberScheduleSchema,
    updateBarberScheduleSchema,
};
