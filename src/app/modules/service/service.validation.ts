import { z } from 'zod';

const AvailableTOEnum = z.enum(['EVERYONE', 'MALE', 'FEMALE']);

const createServiceSchema = z.object({
  body: z.object({
    saloonId: z.string({
      required_error: 'Saloon owner ID is required!',
    }),
    serviceName: z.string({
      required_error: 'Service name is required!',
    }),
    availableTo: AvailableTOEnum.optional().default('EVERYONE'),
    price: z.number({
      required_error: 'Price is required!',
      invalid_type_error: 'Price must be a number!',
    }),
    duration: z.number({
      required_error: 'Duration is required!',
      invalid_type_error: 'Duration must be a number in minutes!',
    }),
    isActive: z.boolean().optional().default(true),
  }),
});

const updateServiceSchema = z.object({
  body: z.object({
    serviceName: z.string().optional(),
    availableTo: AvailableTOEnum.optional(),
    price: z.number().optional(),
    duration: z.number().optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({
    serviceId: z.string({
      required_error: 'Service ID is required!',
    }),
  }).optional(),
  query: z.object({
    saloonId: z.string({
      required_error: 'Saloon owner ID is required!',
    }),
  }).optional(),
});  


const toggleServiceActiveSchema = z.object({
  params: z.object({
    serviceId: z.string({
      required_error: 'Service ID is required!',
    }),
  }).optional(),
  query: z.object({
    saloonId: z.string({
      required_error: 'Saloon owner ID is required!',
    }),
  }).optional(),
});

export const serviceValidation = {
createServiceSchema,
updateServiceSchema,
toggleServiceActiveSchema,
};