import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { loyaltySchemeController } from './loyaltyScheme.controller';
import { loyaltySchemeValidation } from './loyaltyScheme.validation';
import { UserRoleEnum } from '@prisma/client';
import checkSubscriptionForSalonOwners from '../../middlewares/checkSubscriptionForSalonOwners';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(loyaltySchemeValidation.createSchema),
  loyaltySchemeController.createLoyaltyScheme,
);

router.get(
  '/',
  auth(),
  checkSubscriptionForSalonOwners(),
  loyaltySchemeController.getLoyaltySchemeList,
);

router.get('/:id', auth(), loyaltySchemeController.getLoyaltySchemeById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(loyaltySchemeValidation.updateSchema),
  loyaltySchemeController.updateLoyaltyScheme,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  loyaltySchemeController.deleteLoyaltyScheme,
);

export const loyaltySchemeRoutes = router;
