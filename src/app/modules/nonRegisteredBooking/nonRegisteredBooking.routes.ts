import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { nonRegisteredBookingController } from './nonRegisteredBooking.controller';
import { nonRegisteredBookingValidation } from './nonRegisteredBooking.validation';
import { UserRoleEnum } from '@prisma/client';
import checkSubscriptionForSalonOwners from '../../middlewares/checkSubscriptionForSalonOwners';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(nonRegisteredBookingValidation.createSchema),
  nonRegisteredBookingController.createNonRegisteredBooking,
);

router.get(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  nonRegisteredBookingController.getNonRegisteredBookingList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  nonRegisteredBookingController.getNonRegisteredBookingById,
);

router.put(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(nonRegisteredBookingValidation.updateSchema),
  nonRegisteredBookingController.updateNonRegisteredBooking,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  nonRegisteredBookingController.deleteNonRegisteredBooking,
);

export const nonRegisteredBookingRoutes = router;
