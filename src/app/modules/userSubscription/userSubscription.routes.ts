import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { userSubscriptionController } from './userSubscription.controller';
import { userSubscriptionValidation } from './userSubscription.validation';
import { checkPermissions } from '../../middlewares/checkPermissions';
import { UserAccessFunctionName } from '../../utils/access';
import { appleIAPController } from './appleIAP.controller';

const router = express.Router();

// ===== Apple IAP Routes =====

// POST: Verify Apple receipt after purchase
router.post(
  '/apple/verify-receipt',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(userSubscriptionValidation.verifyAppleReceiptSchema),
  appleIAPController.verifyAppleReceipt,
);

// POST: Apple Server-to-Server Notifications Webhook
// IMPORTANT: This endpoint does NOT require authentication as it's called by Apple servers
router.post(
  '/apple/webhook',
  appleIAPController.handleAppleWebhook,
);

// POST: Check subscription status via transaction ID
router.post(
  '/apple/check-status',
  auth(UserRoleEnum.SALOON_OWNER),
  appleIAPController.checkSubscriptionStatus,
);

// POST: Get transaction history for restoration
router.post(
  '/apple/transaction-history',
  auth(UserRoleEnum.SALOON_OWNER),
  appleIAPController.getTransactionHistory,
);

// ===== Subscription Management Routes =====

// POST: Create subscription (now with Apple receipt)
router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(userSubscriptionValidation.createSchema),
  userSubscriptionController.createUserSubscription,
);

// get plans list sync with apple products
router.get(
  '/plans',
  auth(UserRoleEnum.SALOON_OWNER),
  appleIAPController.getSubscriptionPlans,
);

// GET: List all subscriptions (Admin only)
router.get(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.PREMIUM_SUBSCRIBERS,
  ),
  userSubscriptionController.getUserSubscriptionList,
);

// GET: Get owner's subscription plan
router.get(
  '/own-plan',
  auth(UserRoleEnum.SALOON_OWNER),
  userSubscriptionController.getUOwnerSubscriptionPlan,
);

// GET: Get subscription by ID
router.get(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.PREMIUM_SUBSCRIBERS,
  ),
  userSubscriptionController.getUserSubscriptionById,
);

// PUT: Renew subscription (now with Apple receipt)
router.put(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(userSubscriptionValidation.updateSchema),
  userSubscriptionController.updateUserSubscription,
);

// PATCH: Cancel automatic renewal
router.patch(
  '/cancel-automatic-renewal/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  userSubscriptionController.cancelAutomaticRenewal,
);

// DELETE: User deletes their subscription
router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  userSubscriptionController.deleteUserSubscription,
);

// DELETE: Admin deletes a subscription
router.delete(
  '/admin/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.PREMIUM_SUBSCRIBERS,
  ),
  userSubscriptionController.deleteUserSubscriptionForCustomer,
);

export const userSubscriptionRoutes = router;
