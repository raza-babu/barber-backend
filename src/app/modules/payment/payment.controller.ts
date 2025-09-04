import { Request, Response } from 'express';

import httpStatus from 'http-status';

import { StripeServices } from './payment.service';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import config from '../../../config';
import prisma from '../../utils/prisma';
import Stripe from 'stripe';
import { PaymentStatus, SubscriptionPlanStatus } from '@prisma/client';

// Initialize Stripe with your secret API key
const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-07-30.basil',
});

const createAccount = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await StripeServices.createAccountIntoStripe(user.id);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Create account successfully',
    data: result,
  });
});

const createNewAccount = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await StripeServices.createNewAccountIntoStripe(user.id);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Create new account successfully',
    data: result,
  });
});

// create a new customer with card
const saveCardWithCustomerInfo = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as any;
    const result = await StripeServices.saveCardWithCustomerInfoIntoStripe(
      user,
      req.body,
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Create customer and save card successfully',
      data: result,
    });
  },
);

// Authorize the customer with the amount and send payment request
const authorizedPaymentWithSaveCard = catchAsync(async (req: any, res: any) => {
  const user = req.user as any;
  const result = await StripeServices.authorizeAndSplitPayment(
    user.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Authorized customer and payment request successfully',
    data: result,
  });
});

// Capture the payment request and deduct the amount
const capturePaymentRequest = catchAsync(async (req: any, res: any) => {
  const user = req.user as any;
  const result = await StripeServices.capturePaymentRequestToStripe(
    user.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Capture payment request and payment deduct successfully',
    data: result,
  });
});

// Save new card to existing customer
const saveNewCardWithExistingCustomer = catchAsync(
  async (req: any, res: any) => {
    const result =
      await StripeServices.saveNewCardWithExistingCustomerIntoStripe(req.body);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'New card save successfully',
      data: result,
    });
  },
);

// Get all save cards for customer
const getCustomerSavedCards = catchAsync(async (req: any, res: any) => {
  const user = req.user as any;
  const result = await StripeServices.getCustomerSavedCardsFromStripe(user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Retrieve customer cards successfully',
    data: result,
  });
});

// Delete card from customer
const deleteCardFromCustomer = catchAsync(async (req: any, res: any) => {
  const result = await StripeServices.deleteCardFromCustomer(
    req.params?.paymentMethodId,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Delete a card successfully',
    data: result,
  });
});

// Refund payment to customer
const refundPaymentToCustomer = catchAsync(async (req: any, res: any) => {
  const result = await StripeServices.refundPaymentToCustomer(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Refund payment successfully',
    data: result,
  });
});

//payment from owner to rider
const createPaymentIntent = catchAsync(async (req: any, res: any) => {
  const result = await StripeServices.createPaymentIntentService(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Stipe payment successful',
    data: result,
  });
});

const getCustomerDetails = catchAsync(async (req: any, res: any) => {
  const user = req.user as any;
  const result = await StripeServices.getCustomerDetailsFromStripe(user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Retrieve customer cards successfully',
    data: result,
  });
});

const getAllCustomers = catchAsync(async (req: any, res: any) => {
  const result = await StripeServices.getAllCustomersFromStripe();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Retrieve customer details successfully',
    data: result,
  });
});

const handleWebHook = catchAsync(async (req: any, res: any) => {
  const sig = req.headers['stripe-signature'] as string;
  console.log(sig);

  if (!sig) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Missing Stripe signature header.',
      data: null,
    });
  }

  let event: Stripe.Event;

  try {
    event = Stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.stripe_webhook_secret as string,
    );
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return res.status(400).send('Webhook Error');
  }

  // Handle the event types
  switch (event.type) {
    case 'account.updated':
      const account = event.data.object;
      console.log(account, 'check account from webhook');

      if (
        account.charges_enabled &&
        account.details_submitted &&
        account.payouts_enabled
      ) {
        console.log(
          'Onboarding completed successfully for account:',
          account.id,
        );
        const user = await prisma.user.update({
          where: {
            id: account.metadata?.userId,
            email: account.email!,
          },
          data: {
            onBoarding: true,
          },
        });
        if (!user) {
          return sendResponse(res, {
            statusCode: httpStatus.NOT_FOUND,
            success: false,
            message: 'User not found',
            data: null,
          });
        }
        if (user) {
          await prisma.user.update({
            where: {
              id: account.metadata?.userId,
            },
            data: {
              stripeAccountUrl: null,
            },
          });
        }
      } else {
        console.log('Onboarding incomplete for account:', account.id);
      }
      break;

    case 'customer.subscription.created': {
      const subscription = event.data.object as Stripe.Subscription;

      // console.log(subscription, 'check subscription created');

      // find user by customerId
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isSubscribed: true,
            subscriptionEnd: new Date(
              (subscription as any).current_period_end * 1000,
            ), // Stripe gives timestamp in seconds
          },
        });
        await prisma.payment.updateMany({
          where: {
            stripeSubscriptionId: subscription.id,
          },
          data: {
            status: PaymentStatus.COMPLETED,
            invoiceId: subscription.latest_invoice as string,
          },
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });

      if (!user) break;

      // Find which plan this subscription is tied to
      const subscriptionOffer = await prisma.subscriptionOffer.findFirst({
        where: { stripePriceId: subscription.items.data[0].price.id },
      });

      // Update the user with subscription details
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isSubscribed: subscription.status === 'active',
          subscriptionEnd: new Date(
            (subscription as any).current_period_end * 1000,
          ),
          subscriptionPlan: subscriptionOffer
            ? subscriptionOffer.planType // map to actual plan
            : SubscriptionPlanStatus.FREE,
        },
      });

      const paymentToUpdate = await prisma.payment.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });

      // If subscription was canceled/refunded → trigger refund logic
      if (subscription.status === 'canceled') {
        // Optional: call Stripe refund API first, then update DB
        const refund = await stripe.refunds.create({
          payment_intent: paymentToUpdate?.paymentIntentId!,
        });

        console.log(refund, 'check refund');

        await prisma.payment.updateMany({
          where: {
            stripeSubscriptionId: subscription.id,
            status: PaymentStatus.COMPLETED,
          },
          data: { status: PaymentStatus.REFUNDED },
        });

        await prisma.user.update({
          where: { id: user.id },
          data: {
            isSubscribed: false,
            subscriptionEnd: new Date(), // Expired now
            subscriptionPlan: SubscriptionPlanStatus.FREE,
          },
        });

        await prisma.userSubscription.updateMany({
          where: {
            userId: user.id,
          },
          data: { paymentStatus: PaymentStatus.REFUNDED, endDate: new Date() },
        });

        // console.log('Subscription canceled and refund processed:', refund);
      }

      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      // console.log(subscription, 'check subscription deleted');


      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });

      console.log(user, 'check user from subscription deleted');

      const paymentToUpdate = await prisma.payment.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });
      const refund = await stripe.refunds.create({
          payment_intent: paymentToUpdate?.paymentIntentId!,
        });

        // console.log(refund, 'check refund');

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isSubscribed: false,
            subscriptionEnd: new Date(), // Expired now
            subscriptionPlan: SubscriptionPlanStatus.FREE,
          },
        });



        await prisma.userSubscription.updateMany({
          where: {
            stripeSubscriptionId: subscription.id,
            paymentStatus: PaymentStatus.COMPLETED,
          },
          data: { endDate: new Date(), paymentStatus: PaymentStatus.REFUNDED },
        });
        await prisma.payment.updateMany({
          where: {
            stripeSubscriptionId: subscription.id,
            status: PaymentStatus.COMPLETED,
          },
          data: { status: PaymentStatus.REFUNDED },
        });
      }
      break;
    }

    case 'capability.updated':
      console.log('Capability updated event received. Handle accordingly.');
      break;

    case 'invoice.paid': {
      // Stripe sends the invoice object
      const invoice = event.data.object as any;

      // Extract the invoice ID and PaymentIntent ID
      const invoiceId = invoice.id;
      const paymentIntentId = invoice.payment_intent;
      const subscriptionId = invoice.subscription;
      console.log(subscriptionId, 'check subscription id from invoice');

      // Find the related payment record in your DB
      const paymentRecord = await prisma.payment.findUnique({
        where: {
          stripeSubscriptionId: subscriptionId!,
          invoiceId: invoiceId!,
        },
      });

      console.log(paymentRecord, 'check payment record for invoice');
      if (!paymentRecord) {
        console.log('No payment record found for invoice:', invoiceId);
        break;
      }

      await prisma.payment.update({
        where: { id: paymentRecord.id },
        data: {
          status: PaymentStatus.COMPLETED, 
          paymentIntentId: paymentIntentId,
        },
      });

      break;
    }

    case 'invoice.payment_failed':
      const failedInvoice = event.data.object as Stripe.Invoice;
      console.log('Invoice payment failed for invoice:', failedInvoice.id);
      // You can add logic here to handle failed invoice payments
      break;

    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('PaymentIntent was successful!', paymentIntent.id);
      // You can add logic here to handle successful payment intents
      break;

    case 'payment_method.attached':
      const paymentMethod = event.data.object as Stripe.PaymentMethod;
      console.log(
        'PaymentMethod was attached to a Customer!',
        paymentMethod.id,
      );
      // You can add logic here to handle the attachment of a payment method
      break;

    case 'financial_connections.account.created':
      console.log(
        'Financial connections account created event received. Handle accordingly.',
      );
      break;

    case 'account.application.authorized':
      const authorizedAccount = event.data.object;
      console.log('Application authorized for account:', authorizedAccount.id);
      // Add your logic to handle this event
      break;

    case 'customer.created':
      const customer = event.data.object;
      console.log('New customer created:', customer.id);

      break;
    case 'account.external_account.created':
      const externalAccount = event.data.object;
      console.log('External account created:', externalAccount);

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).send('Event received');
});

export const PaymentController = {
  saveCardWithCustomerInfo,
  authorizedPaymentWithSaveCard,
  capturePaymentRequest,
  saveNewCardWithExistingCustomer,
  getCustomerSavedCards,
  deleteCardFromCustomer,
  refundPaymentToCustomer,
  createPaymentIntent,
  getCustomerDetails,
  getAllCustomers,
  createAccount,
  createNewAccount,
  handleWebHook,
};
