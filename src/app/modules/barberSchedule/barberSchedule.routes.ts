import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { barberScheduleController } from './barberSchedule.controller';
import { barberScheduleValidation } from './barberSchedule.validation';
import checkSubscriptionForSalonOwners from '../../middlewares/checkSubscriptionForSalonOwners';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(barberScheduleValidation.createBarberScheduleSchema),
  barberScheduleController.createBarberSchedule,
);

router.get(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  barberScheduleController.getBarberScheduleList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  barberScheduleController.getBarberScheduleById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(barberScheduleValidation.updateBarberScheduleSchema),
  barberScheduleController.updateBarberSchedule,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  barberScheduleController.deleteBarberSchedule,
);

export const barberScheduleRoutes = router;
