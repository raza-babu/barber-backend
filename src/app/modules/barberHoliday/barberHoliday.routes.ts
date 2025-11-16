import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { barberHolidayController } from './barberHoliday.controller';
import { barberHolidayValidation } from './barberHoliday.validation';
import checkSubscriptionForSalonOwners from '../../middlewares/checkSubscriptionForSalonOwners';
import  auth  from '../../middlewares/auth';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(barberHolidayValidation.createBarberDayOffSchema),
  barberHolidayController.createBarberHoliday,
);

router.get(
  '/',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  checkSubscriptionForSalonOwners(),
  barberHolidayController.getBarberHolidayList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  checkSubscriptionForSalonOwners(),
  barberHolidayController.getBarberHolidayById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(barberHolidayValidation.updateBarberDayOffSchema),
  barberHolidayController.updateBarberHoliday,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  barberHolidayController.deleteBarberHoliday,
);

export const barberHolidayRoutes = router;
