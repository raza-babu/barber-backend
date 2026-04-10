import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import { PaymentController } from './payment.controller';

const router = express.Router();

import {
  AuthorizedPaymentPayloadSchema,
  cancelPaymentPayloadSchema,
  capturedPaymentPayloadSchema,
  refundPaymentPayloadSchema,
  saveNewCardWithExistingCustomerPayloadSchema,
  tipPayloadSchema,
  TStripePayoutToBarberPayloadSchema,
  TStripeSaveWithCustomerInfoPayloadSchema,
} from './payment.validation';
import validateRequest from '../../middlewares/validateRequest';
import {
  checkBarberPaymentReadiness,
  checkSaloonOwnerPaymentReadiness,
} from '../../middlewares/checkPaymentReadiness';

router.post('/create-account', auth(), PaymentController.createAccount);

router.post('/create-new-account', auth(), PaymentController.createNewAccount);

// create a new customer with card
router.post(
  '/save-card',
  auth(),
  validateRequest(TStripeSaveWithCustomerInfoPayloadSchema),
  PaymentController.saveCardWithCustomerInfo,
);

// Authorize the customer with the amount and send payment request
router.post(
  '/authorize-payment',
  auth(),
  validateRequest(AuthorizedPaymentPayloadSchema),
  PaymentController.authorizedPaymentWithSaveCard,
);

// Capture the payment request and deduct the amount
router.post(
  '/capture-payment',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(capturedPaymentPayloadSchema),
  PaymentController.capturePaymentRequest,
);

router.post(
  '/cancel-payment',
  auth(),
  validateRequest(cancelPaymentPayloadSchema),
  PaymentController.cancelPaymentRequest,
);

router.post(
  '/cancel-queue-payment',
  auth(),
  validateRequest(cancelPaymentPayloadSchema),
  PaymentController.cancelQueuePaymentRequest,
);

// Save new card to existing customer
router.post(
  '/save-new-card',
  validateRequest(saveNewCardWithExistingCustomerPayloadSchema),
  PaymentController.saveNewCardWithExistingCustomer,
);

// Get all save cards for customer

// Delete card from customer
router.delete(
  '/delete-card/:paymentMethodId',
  PaymentController.deleteCardFromCustomer,
);

// Refund payment to customer
router.post(
  '/refund-payment',
  validateRequest(refundPaymentPayloadSchema),
  PaymentController.refundPaymentToCustomer,
);
router.get(
  '/customer-save-cards',
  auth(),
  PaymentController.getCustomerSavedCards,
);

router.get('/customers', auth(), PaymentController.getAllCustomers);

router.get('/', auth(), PaymentController.getCustomerDetails);

router.post(
  '/tip-payment',
  auth(UserRoleEnum.CUSTOMER),
  validateRequest(tipPayloadSchema),
  PaymentController.tipPaymentToBarber,
);

//
router.post(
  '/payout-barber',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(TStripePayoutToBarberPayloadSchema),
  PaymentController.payoutToBarber,
);

// Barber Payout Management Routes
router.get(
  '/barber-payouts',
  auth(),
  PaymentController.getPendingBarberPayouts,
);

router.post(
  '/barber-payouts/:payoutRequestId/settle',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  PaymentController.settleBarberPayout,
);

router.post(
  '/barber-payouts/:payoutRequestId/reject',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  PaymentController.rejectBarberPayout,
);

router.get(
  '/check-balance',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER, UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN),
  PaymentController.checkAvailableBalance,
);

router.post(
  '/withdraw-funds',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  PaymentController.withdrawFundsFromStripe,
);

export const PaymentRoutes = router;
