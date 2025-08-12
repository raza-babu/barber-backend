import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { saloonScheduleController } from './saloonSchedule.controller';
import { saloonScheduleValidation } from './saloonSchedule.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(saloonScheduleValidation.createSaloonScheduleSchema),
  saloonScheduleController.createSaloonSchedule,
);

router.get('/', auth(), saloonScheduleController.getSaloonScheduleList);

router.get('/:id', auth(), saloonScheduleController.getSaloonScheduleById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(saloonScheduleValidation.updateSaloonScheduleSchema),
  saloonScheduleController.updateSaloonSchedule,
);

router.delete('/', auth(UserRoleEnum.SALOON_OWNER), saloonScheduleController.deleteSaloonSchedule);

export const saloonScheduleRoutes = router;
