import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { userSubscriptionController } from './userSubscription.controller';
import { userSubscriptionValidation } from './userSubscription.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(userSubscriptionValidation.createSchema),
  userSubscriptionController.createUserSubscription,
);

router.get('/', auth(), userSubscriptionController.getUserSubscriptionList);

router.get('/:id', auth(), userSubscriptionController.getUserSubscriptionById);

router.put(
  '/:id',
  auth(),
  validateRequest(userSubscriptionValidation.updateSchema),
  userSubscriptionController.updateUserSubscription,
);

router.delete(
  '/:id',
  auth(),
  userSubscriptionController.deleteUserSubscription,
);

export const userSubscriptionRoutes = router;
