import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { saloonHolidayController } from './saloonHoliday.controller';
import { saloonHolidayValidation } from './saloonHoliday.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(saloonHolidayValidation.createSaloonHolidaySchema),
  saloonHolidayController.createSaloonHoliday,
);
 
router.get(
  '/',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  saloonHolidayController.getSaloonHolidayList,
);

router.get(
  '/check',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  saloonHolidayController.checkSaloonHoliday,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  saloonHolidayController.getSaloonHolidayById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(saloonHolidayValidation.updateSaloonHolidaySchema),
  saloonHolidayController.updateSaloonHoliday,
);

router.delete('/:id', auth(UserRoleEnum.SALOON_OWNER), saloonHolidayController.deleteSaloonHoliday);

export const saloonHolidayRoutes = router;
