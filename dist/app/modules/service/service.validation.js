"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceValidation = void 0;
const zod_1 = require("zod");
const AvailableTOEnum = zod_1.z.enum(['EVERYONE', 'MALE', 'FEMALE']);
const createServiceSchema = zod_1.z.object({
    body: zod_1.z.object({
        saloonId: zod_1.z.string({
            required_error: 'Saloon owner ID is required!',
        }),
        serviceName: zod_1.z.string({
            required_error: 'Service name is required!',
        }),
        availableTo: AvailableTOEnum.optional().default('EVERYONE'),
        price: zod_1.z.number({
            required_error: 'Price is required!',
            invalid_type_error: 'Price must be a number!',
        }),
        duration: zod_1.z.number({
            required_error: 'Duration is required!',
            invalid_type_error: 'Duration must be a number in minutes!',
        }),
        isActive: zod_1.z.boolean().optional().default(true),
    }),
});
const updateServiceSchema = zod_1.z.object({
    body: zod_1.z.object({
        serviceName: zod_1.z.string().optional(),
        availableTo: AvailableTOEnum.optional(),
        price: zod_1.z.number().optional(),
        duration: zod_1.z.number().optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
    params: zod_1.z.object({
        serviceId: zod_1.z.string({
            required_error: 'Service ID is required!',
        }),
    }).optional(),
    query: zod_1.z.object({
        saloonId: zod_1.z.string({
            required_error: 'Saloon owner ID is required!',
        }),
    }).optional(),
});
const toggleServiceActiveSchema = zod_1.z.object({
    params: zod_1.z.object({
        serviceId: zod_1.z.string({
            required_error: 'Service ID is required!',
        }),
    }).optional(),
    query: zod_1.z.object({
        saloonId: zod_1.z.string({
            required_error: 'Saloon owner ID is required!',
        }),
    }).optional(),
});
exports.serviceValidation = {
    createServiceSchema,
    updateServiceSchema,
    toggleServiceActiveSchema,
};
