import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { queueCapacityController } from './queueCapacity.controller';
import { queueCapacityValidation } from './queueCapacity.validation';
import checkSubscriptionForSalonOwners from '../../middlewares/checkSubscriptionForSalonOwners';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(queueCapacityValidation.createSchema),
  queueCapacityController.createQueueCapacity,
);

router.get('/', auth(), queueCapacityController.getQueueCapacityList);

router.get('/:id', auth(), queueCapacityController.getQueueCapacityById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(queueCapacityValidation.updateSchema),
  queueCapacityController.updateQueueCapacity,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  queueCapacityController.deleteQueueCapacity,
);

export const queueCapacityRoutes = router;
