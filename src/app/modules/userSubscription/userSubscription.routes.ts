import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { userSubscriptionController } from './userSubscription.controller';
import { userSubscriptionValidation } from './userSubscription.validation';
import { checkPermissions } from '../../middlewares/checkPermissions';
import { UserAccessFunctionName } from '../../utils/access';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(userSubscriptionValidation.createSchema),
  userSubscriptionController.createUserSubscription,
);

router.get(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.PREMIUM_SUBSCRIBERS,
  ),
  userSubscriptionController.getUserSubscriptionList,
);

router.get(
  '/own-plan',
  auth(UserRoleEnum.SALOON_OWNER),
  userSubscriptionController.getUOwnerSubscriptionPlan,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.PREMIUM_SUBSCRIBERS,
  ),
  userSubscriptionController.getUserSubscriptionById,
);

router.put(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(userSubscriptionValidation.updateSchema),
  userSubscriptionController.updateUserSubscription,
);

router.patch(
  '/cancel-automatic-renewal/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  userSubscriptionController.cancelAutomaticRenewal,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  userSubscriptionController.deleteUserSubscription,
);
router.delete(
  '/admin/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.PREMIUM_SUBSCRIBERS,
  ),
  userSubscriptionController.deleteUserSubscriptionForCustomer,
);

export const userSubscriptionRoutes = router;
