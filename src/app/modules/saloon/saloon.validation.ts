import { BookingStatus } from '@prisma/client';
import { z } from 'zod';
import moment from 'moment-timezone';
import { DEFAULT_TIMEZONE } from '../../utils/timezone.helper';

const createSchema = z.object({
  body: z.object({
    bookingId: z.string({
      required_error: 'Booking ID is required!',
    }),
    status: z.nativeEnum(BookingStatus),
  }),
});

const updateSchema = z.object({
  body: z.object({
    bookingId: z.string({
      required_error: 'Booking ID is required!',
    }),
    status: z.nativeEnum(BookingStatus),
  }),
});

const updateQueueSchema = z.object({
  body: z.object({
    isQueueEnabled: z.boolean({
      required_error: 'isQueueEnabled is required!',
    }),
  }),
});

function convertToUTC(
  date: string,
  time: string,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const trimmedTime = time.trim();
  const m = moment.tz(
    `${date} ${trimmedTime}`,
    [
      'YYYY-MM-DD hh:mm A',
      'YYYY-MM-DD h:mm A',
      'YYYY-MM-DD hh:mma',
      'YYYY-MM-DD h:mma',
      'YYYY-MM-DD HH:mm',
    ],
    timezone,
  );

  if (!m.isValid()) {
    throw new Error('Invalid date or time format');
  }

  return m.toISOString();
}

const availableBarbersSchema = z.object({
  query: z
    .object({
      date: z.string({
        required_error: 'Date is required!',
      }),
      time: z.string().regex(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, {
        message: 'Time must be in hh:mm AM/PM format',
      }),
      // totalServiceTime: z.coerce.number().int().positive(),
    })
    .transform(({ date, time }) => ({
      date,
      time,
      utcDateTime: convertToUTC(date, time),
    })),
});

const availableFreeBarbersSchema = z.object({
  query: z
    .object({
      date: z.coerce.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .transform(({ date }) => {
      const m = moment.tz(date, DEFAULT_TIMEZONE).startOf('day');
      return {
        date,
        utcDateTime: m.toISOString(),
      };
    }),
});

const getUnemployedBarbersSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform(val => (val ? Number(val) : 1)),
    limit: z
      .string()
      .optional()
      .transform(val => (val ? Number(val) : 10)),
    searchTerm: z.string().optional(),
  }),
});

const directHireSchema = z.object({
  body: z.object({
    barberId: z.string({
      required_error: 'Barber ID is required!',
    }),
    hourlyRate: z
      .number({
        required_error: 'Hourly rate is required!',
      })
      .min(0, 'Hourly rate cannot be negative'),
  }),
});

export const saloonValidation = {
  createSchema,
  updateSchema,
  updateQueueSchema,
  availableBarbersSchema,
  availableFreeBarbersSchema,
  getUnemployedBarbersSchema,
  directHireSchema,
};

export type TGetUnEmployeedBarbersQueryType = z.infer<
  typeof getUnemployedBarbersSchema.shape.query
>;
export type TGetDirectHirePayloadType = z.infer<
  typeof directHireSchema.shape.body
>;
