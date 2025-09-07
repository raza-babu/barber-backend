import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { barberLunchController } from './barberLunch.controller';
import { barberLunchValidation } from './barberLunch.validation';
import { UserRoleEnum } from '@prisma/client';
import checkSubscriptionForSalonOwners from '../../middlewares/checkSubscriptionForSalonOwners';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(barberLunchValidation.createBarberLunchSchema),
  barberLunchController.createBarberLunch,
);

router.get(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  barberLunchController.getBarberLunchList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  barberLunchController.getBarberLunchById,
);

router.put(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(barberLunchValidation.updateBarberLunchSchema),
  barberLunchController.updateBarberLunch,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  barberLunchController.deleteBarberLunch,
);

export const barberLunchRoutes = router;
