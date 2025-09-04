"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saloonHolidayValidation = void 0;
const zod_1 = require("zod");
const createSaloonHolidaySchema = zod_1.z.object({
    body: zod_1.z.object({
        saloonId: zod_1.z.string().optional(),
        date: zod_1.z.string()
            .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' })
            .transform((val) => new Date(val).toISOString()),
        holidayName: zod_1.z.string().min(1, 'Holiday name is required'),
        description: zod_1.z.string().optional(),
        isRecurring: zod_1.z.boolean().default(false)
    })
});
const updateSaloonHolidaySchema = zod_1.z.object({
    body: zod_1.z.object({
        date: zod_1.z.string()
            .refine((val) => val === undefined || !isNaN(Date.parse(val)), { message: 'Invalid date format' })
            .transform((val) => val === undefined ? val : new Date(val).toISOString())
            .optional(),
        holidayName: zod_1.z.string().min(1, 'Holiday name is required').optional(),
        description: zod_1.z.string().optional(),
        isRecurring: zod_1.z.boolean().optional()
    })
});
exports.saloonHolidayValidation = {
    createSaloonHolidaySchema,
    updateSaloonHolidaySchema
};
