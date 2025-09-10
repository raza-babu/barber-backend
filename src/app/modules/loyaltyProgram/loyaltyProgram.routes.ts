import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { loyaltyProgramController } from './loyaltyProgram.controller';
import { loyaltyProgramValidation } from './loyaltyProgram.validation';
import checkSubscriptionForSalonOwners from '../../middlewares/checkSubscriptionForSalonOwners';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(loyaltyProgramValidation.createSchema),
  loyaltyProgramController.createLoyaltyProgram,
);

router.get(
  '/',
  auth(),
  checkSubscriptionForSalonOwners(),
  loyaltyProgramController.getLoyaltyProgramList,
);

router.get(
  '/:id',
  auth(),
  checkSubscriptionForSalonOwners(),
  loyaltyProgramController.getLoyaltyProgramById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(loyaltyProgramValidation.updateSchema),
  loyaltyProgramController.updateLoyaltyProgram,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  loyaltyProgramController.deleteLoyaltyProgram,
);

export const loyaltyProgramRoutes = router;
