import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required'),
    email: z.string().email('Invalid email format'),
    phoneNumber: z.string().min(1, 'Phone number is required').optional(),
    notes: z.string().optional(),
    barberId: z.string().min(1, 'Barber ID is required'),
    appointmentAt: z.string().min(1, 'Appointment date-time is required'),
    date: z.string().min(1, 'Date is required'),
    services: z.array(z.string()).min(1, 'At least one service is required'),
    isInQueue: z.boolean().optional(),
  }),
});

const updateSchema = z.object({
  body: z.object({
    fullName: z.string().optional(),
    email: z.string().email('Invalid email format').optional(),
    phoneNumber: z.string().optional(),
    notes: z.string().optional(),
    appointmentAt: z.string().optional(),
    date: z.string().optional(),
    services: z.array(z.string()).optional(),
    isInQueue: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'Booking ID is required'), // ID of the booking to update
  }),
});

export const nonRegisteredBookingValidation = {
  createSchema,
  updateSchema,
};
