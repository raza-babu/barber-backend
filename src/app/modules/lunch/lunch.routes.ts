import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { lunchController } from './lunch.controller';
import { lunchValidation } from './lunch.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(lunchValidation.createLunchSchema),
  lunchController.createLunch,
);

router.get(
  '/',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  lunchController.getLunchList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  lunchController.getLunchById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(lunchValidation.updateLunchSchema),
  lunchController.updateLunch,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  lunchController.deleteLunch,
);

export const lunchRoutes = router;
