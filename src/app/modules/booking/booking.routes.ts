import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { bookingController } from './booking.controller';
import { bookingValidation } from './booking.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.CUSTOMER),
  validateRequest(bookingValidation.createBookingSchema),
  bookingController.createBooking,
);

router.get('/', auth(), bookingController.getBookingList);

router.get(
  '/barbers',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.CUSTOMER),
  validateRequest(bookingValidation.availableBarbersSchema),
  bookingController.getAvailableBarbers,
);

router.get('/:id', auth(), bookingController.getBookingById);

router.put(
  '/:id',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER),
  validateRequest(bookingValidation.updateBookingSchema),
  bookingController.updateBooking,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  bookingController.deleteBooking,
);

export const bookingRoutes = router;
