import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { subscriptionOfferController } from './subscriptionOffer.controller';
import { subscriptionOfferValidation } from './subscriptionOffer.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN),
  validateRequest(subscriptionOfferValidation.createSubscriptionOfferSchema),
  subscriptionOfferController.createSubscriptionOffer,
);

router.get('/', auth(), subscriptionOfferController.getSubscriptionOfferList);

router.get(
  '/:id',
  auth(),
  subscriptionOfferController.getSubscriptionOfferById,
);

router.put(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN),
  validateRequest(subscriptionOfferValidation.updateSubscriptionOfferSchema),
  subscriptionOfferController.updateSubscriptionOffer,
);

router.delete(
  '/:id',
  auth(),
  subscriptionOfferController.deleteSubscriptionOffer,
);

export const subscriptionOfferRoutes = router;
