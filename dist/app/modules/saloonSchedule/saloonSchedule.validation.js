"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saloonScheduleValidation = void 0;
// saloonScheduleValidation.ts
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const customParseFormat_1 = __importDefault(require("dayjs/plugin/customParseFormat"));
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(customParseFormat_1.default);
const timeRange12hRegex = /^((0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM))\s*-\s*((0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM))$/i;
function convertToUTCWithDisplay(timeRange) {
    const [opening, closing] = timeRange.split('-').map(t => t.trim());
    const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
    const openingUTC = (0, dayjs_1.default)(`${today} ${opening}`, 'YYYY-MM-DD hh:mm A').utc().toDate();
    const closingUTC = (0, dayjs_1.default)(`${today} ${closing}`, 'YYYY-MM-DD hh:mm A').utc().toDate();
    // Keep original 12h display format
    const openingTimeDisplay = (0, dayjs_1.default)(`${today} ${opening}`, 'YYYY-MM-DD hh:mm A').format('hh:mm A');
    const closingTimeDisplay = (0, dayjs_1.default)(`${today} ${closing}`, 'YYYY-MM-DD hh:mm A').format('hh:mm A');
    return {
        openingUTC,
        closingUTC,
        openingTime: openingTimeDisplay,
        closingTime: closingTimeDisplay,
    };
}
const daysMap = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
};
const singleDayBaseSchema = zod_1.z.object({
    dayName: zod_1.z
        .string()
        .min(1, 'Day name is required')
        .refine(val => daysMap[val.toLowerCase()] !== undefined, 'Invalid day name'),
    time: zod_1.z.string().regex(timeRange12hRegex, 'Time must be in format "hh:mm AM - hh:mm PM"'),
    isActive: zod_1.z.boolean(),
});
const singleDaySchema = singleDayBaseSchema.transform(data => {
    const { openingUTC, closingUTC, openingTime, closingTime } = convertToUTCWithDisplay(data.time);
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
const createSaloonScheduleSchema = zod_1.z.object({
    body: zod_1.z
        .array(singleDaySchema)
        .length(7, 'Exactly 7 days required')
        .refine(days => {
        const names = days.map(d => d.dayName.toLowerCase());
        return new Set(names).size === 7;
    }, 'Must have all days of the week'),
});
const updateSaloonScheduleSchema = zod_1.z.object({
    body: singleDayBaseSchema.partial(),
});
exports.saloonScheduleValidation = {
    createSaloonScheduleSchema,
    updateSaloonScheduleSchema,
};
