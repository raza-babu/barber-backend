import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { bookingController } from './booking.controller';
import { bookingValidation } from './booking.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(bookingValidation.createSchema),
  bookingController.createBooking,
);

router.get('/', auth(), bookingController.getBookingList);

router.get('/:id', auth(), bookingController.getBookingById);

router.put(
  '/:id',
  auth(),
  validateRequest(bookingValidation.updateSchema),
  bookingController.updateBooking,
);

router.delete('/:id', auth(), bookingController.deleteBooking);

export const bookingRoutes = router;
