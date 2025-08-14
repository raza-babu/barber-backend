import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { barberHolidayController } from './barberHoliday.controller';
import { barberHolidayValidation } from './barberHoliday.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(barberHolidayValidation.createBarberDayOffSchema),
  barberHolidayController.createBarberHoliday,
);

router.get('/', auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER), barberHolidayController.getBarberHolidayList);

router.get('/:id', auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER), barberHolidayController.getBarberHolidayById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(barberHolidayValidation.updateBarberDayOffSchema),
  barberHolidayController.updateBarberHoliday,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  barberHolidayController.deleteBarberHoliday,
);

export const barberHolidayRoutes = router;
