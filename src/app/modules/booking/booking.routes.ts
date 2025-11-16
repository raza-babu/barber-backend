import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { bookingController } from './booking.controller';
import { bookingValidation } from './booking.validation';
import { UserRoleEnum } from '@prisma/client';
import auth  from '../../middlewares/auth';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.CUSTOMER),
  validateRequest(bookingValidation.createBookingSchema),
  bookingController.createBooking,
);

router.get(
  '/customers',
  auth(UserRoleEnum.CUSTOMER),
  bookingController.getBookingList,
);

router.get(
  '/list',
  auth(UserRoleEnum.SALOON_OWNER),
  bookingController.getBookingListForSalonOwner,
);

router.get(
  '/barbers',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.CUSTOMER),
  validateRequest(bookingValidation.availableBarbersSchema),
  bookingController.getAvailableBarbers,
);

router.get(
  '/walking-in/barbers/:saloonId/:type',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.CUSTOMER),
  // validateRequest(bookingValidation.walkingInBarbersSchema),
  bookingController.getAvailableBarbersForWalkingIn,
);
router.get(
  '/barbers/:saloonId/:barberId',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.CUSTOMER),
  // validateRequest(bookingValidation.walkingInBarbersSchema),
  bookingController.getAvailableABarberForWalkingIn,
);

router.get(
  '/customers/:id',
  auth(UserRoleEnum.CUSTOMER),
  bookingController.getBookingById,
);

router.get(
  '/salons/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  bookingController.getBookingByIdForSalonOwner,
);

router.put(
  '/reschedule',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER),
  validateRequest(bookingValidation.updateBookingSchema),
  bookingController.updateBooking,
);

router.put(
  '/schedule-status',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(bookingValidation.updateBookingStatusSchema),
  bookingController.updateBookingStatus,
);

router.patch(
  '/cancel/:id',
  auth(UserRoleEnum.CUSTOMER),
  bookingController.cancelBooking,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  bookingController.deleteBooking,
);

router.get(
  '/loyalty-schemes/:id',
  auth(UserRoleEnum.CUSTOMER),
  bookingController.getLoyaltySchemesForACustomer,
)

export const bookingRoutes = router;
