import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { subscriptionOfferController } from './subscriptionOffer.controller';
import { subscriptionOfferValidation } from './subscriptionOffer.validation';
import { UserRoleEnum } from '@prisma/client';
import { checkPermissions } from '../../middlewares/checkPermissions';
import { UserAccessFunctionName } from '../../utils/access';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.SUBSCRIPTIONS,
  ),
  validateRequest(subscriptionOfferValidation.createSubscriptionOfferSchema),
  subscriptionOfferController.createSubscriptionOffer,
);

router.get('/', auth(), subscriptionOfferController.getSubscriptionOfferList);

router.get(
  '/:id',
  auth(),
  subscriptionOfferController.getSubscriptionOfferById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.SUBSCRIPTIONS,
  ),

  validateRequest(subscriptionOfferValidation.updateSubscriptionOfferSchema),
  subscriptionOfferController.updateSubscriptionOffer,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.SUBSCRIPTIONS,
  ),

  subscriptionOfferController.deleteSubscriptionOffer,
);

export const subscriptionOfferRoutes = router;
