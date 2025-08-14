import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { barberScheduleController } from './barberSchedule.controller';
import { barberScheduleValidation } from './barberSchedule.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(barberScheduleValidation.createBarberScheduleSchema),
  barberScheduleController.createBarberSchedule,
);

router.get(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  barberScheduleController.getBarberScheduleList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  barberScheduleController.getBarberScheduleById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(barberScheduleValidation.updateBarberScheduleSchema),
  barberScheduleController.updateBarberSchedule,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  barberScheduleController.deleteBarberSchedule,
);

export const barberScheduleRoutes = router;
