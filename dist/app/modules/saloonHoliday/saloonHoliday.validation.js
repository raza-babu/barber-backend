"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saloonHolidayValidation = void 0;
const zod_1 = require("zod");
const createSaloonHolidaySchema = zod_1.z.object({
    body: zod_1.z.object({
        saloonId: zod_1.z.string().optional(),
        date: zod_1.z.string().datetime({ offset: true }), // ISO 8601 format
        holidayName: zod_1.z.string().min(1, 'Holiday name is required'),
        description: zod_1.z.string().optional(),
        isRecurring: zod_1.z.boolean().default(false)
    })
});
const updateSaloonHolidaySchema = zod_1.z.object({
    body: zod_1.z.object({
        date: zod_1.z.string().datetime({ offset: true }).optional(),
        holidayName: zod_1.z.string().min(1).optional(),
        description: zod_1.z.string().optional(),
        isRecurring: zod_1.z.boolean().optional()
    })
});
exports.saloonHolidayValidation = {
    createSaloonHolidaySchema,
    updateSaloonHolidaySchema
};
