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
  TStripeSaveWithCustomerInfoPayloadSchema,
} from './payment.validation';
import validateRequest from '../../middlewares/validateRequest';

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

router.post(
  '/payout-barber',
  auth(UserRoleEnum.BARBER),
  PaymentController.payoutToBarber,
);

router.post(
  '/withdraw-funds',
  auth(UserRoleEnum.BARBER),
  PaymentController.withdrawFundsFromStripe,
)

export const PaymentRoutes = router;
