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
  apiVersion: '2025-08-27.basil',
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
    message: 'Checkout session created successfully. Redirect to payment URL.',
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

const cancelPaymentRequest = catchAsync(async (req: any, res: any) => {
  const user = req.user as any;
  const result = await StripeServices.cancelPaymentRequestToStripe(
    user.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Cancel payment request successfully',
    data: result,
  });
});

const cancelQueuePaymentRequest = catchAsync(async (req: any, res: any) => {
  const user = req.user as any;
  const result = await StripeServices.cancelQueuePaymentRequestToStripe(
    user.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Cancel queue payment request successfully',
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

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      const bookingId = session.client_reference_id;
      if (!bookingId) break;

      try {
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: {
            saloonOwner: {
              include: {
                user: true,
              },
            },
            user: true,
          },
        });

        if (!booking) {
          console.log('Booking not found for session:', session.id);
          break;
        }

        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id;

        if (!paymentIntentId) {
          console.log('No payment intent found in session:', session.id);
          break;
        }

        // Check if payment already exists
        const existingPayment = await prisma.payment.findFirst({
          where: {
            bookingId: bookingId,
            paymentIntentId: paymentIntentId,
          },
        });

        if (existingPayment) {
          console.log('Payment already exists for booking:', bookingId);
          break;
        }

        // Create Payment record with REQUIRES_CAPTURE status
        const metadata = session.metadata || {};
        const transferAmount = parseInt(metadata.transferAmount || '0');
        const adminFeeAmount = parseInt(metadata.adminFeeAmount || '50');

        const payment = await prisma.payment.create({
          data: {
            userId: booking.user?.id as string,
            bookingId: booking.id,
            paymentIntentId: paymentIntentId,
            paymentAmount: transferAmount / 100,
            status: PaymentStatus.REQUIRES_CAPTURE,
            // paymentMethodId: session.payment_method || '',
            amountProvider: booking.user?.stripeCustomerId || '',
            amountReceiver: booking.saloonOwner.user?.stripeAccountId || '',
          },
        });

        console.log(
          'Payment record created via webhook for booking:',
          bookingId,
          'Payment ID:',
          payment.id,
        );

        // Optional: Update booking to CONFIRMED when checkout completes
        // await prisma.booking.update({
        //   where: { id: bookingId },
        //   data: { status: BookingStatus.CONFIRMED },
        // });
      } catch (error) {
        console.error('Error processing checkout.session.completed:', error);
      }

      break;
    }

    // case 'customer.subscription.updated': {
    //   const subscription = event.data.object as Stripe.Subscription;

    //   const user = await prisma.user.findFirst({
    //     where: { stripeCustomerId: subscription.customer as string },
    //   });

    //   if (!user) break;
    //   // Find which plan this subscription is tied to
    //   let planType: SubscriptionPlanStatus = SubscriptionPlanStatus.FREE;
    //   if (subscription.items.data.length > 0) {
    //     const subscriptionOffer = await prisma.subscriptionOffer.findFirst({
    //       where: { stripePriceId: subscription.items.data[0].price.id },
    //     });
    //     planType = subscriptionOffer?.planType ?? SubscriptionPlanStatus.FREE;
    //   }

    //   // Get current_period_end from subscription items
    //   const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
    //   const subscriptionEndDate = currentPeriodEnd
    //     ? new Date(currentPeriodEnd * 1000)
    //     : new Date();

    //   // Handle scheduled cancellations (customer turned off auto-renewal)
    //   if (subscription.cancel_at_period_end) {
    //     await prisma.user.update({
    //       where: { id: user.id },
    //       data: {
    //         isSubscribed: true, // Still active until period ends
    //         subscriptionEnd: subscriptionEndDate,
    //         subscriptionPlan: planType,
    //       },
    //     });
    //     console.log(
    //       'Auto-renewal turned off - subscription continues until:',
    //       subscriptionEndDate,
    //     );
    //   }

    //   // Update user status regardless of cancellation type
    //   await prisma.user.update({
    //     where: { id: user.id },
    //     data: {
    //       isSubscribed: subscription.status === 'active',
    //       subscriptionEnd: subscriptionEndDate,
    //       subscriptionPlan: planType,
    //     },
    //   });

    //   // ONLY process refund if subscription is immediately canceled (not just auto-renewal turned off)
    //   if (
    //     subscription.status === 'canceled' &&
    //     !subscription.cancel_at_period_end
    //   ) {
    //     console.log('Immediate cancellation detected - processing refund');

    //     const paymentToUpdate = await prisma.payment.findFirst({
    //       where: {
    //         stripeSubscriptionId: subscription.id,
    //         status: PaymentStatus.COMPLETED,
    //       },
    //     });

    //     // Only attempt refund if we have a paymentIntentId and subscription was active
    //     if (paymentToUpdate?.paymentIntentId) {
    //       try {
    //         const refund = await stripe.refunds.create({
    //           payment_intent: paymentToUpdate.paymentIntentId,
    //         });
    //         console.log(
    //           'Refund processed for immediate cancellation:',
    //           refund.id,
    //         );
    //       } catch (refundError) {
    //         console.error('Refund failed:', refundError);
    //       }
    //     }

    //     // Update payment status to refunded
    //     await prisma.payment.updateMany({
    //       where: {
    //         stripeSubscriptionId: subscription.id,
    //         status: PaymentStatus.COMPLETED,
    //       },
    //       data: { status: PaymentStatus.REFUNDED },
    //     });

    //     // Update user subscription status
    //     await prisma.userSubscription.updateMany({
    //       where: {
    //         userId: user.id,
    //         stripeSubscriptionId: subscription.id,
    //       },
    //       data: {
    //         paymentStatus: PaymentStatus.REFUNDED,
    //         endDate: new Date(),
    //       },
    //     });
    //   }

    //   break;
    // }

    // case 'customer.subscription.updated': {
    //   const subscription = event.data.object as Stripe.Subscription;

    //   const user = await prisma.user.findFirst({
    //     where: { stripeCustomerId: subscription.customer as string },
    //   });

    //   if (!user) break;

    //   // Find which plan this subscription is tied to
    //   let planType: SubscriptionPlanStatus = SubscriptionPlanStatus.FREE;
    //   if (subscription.items.data.length > 0) {
    //     const subscriptionOffer = await prisma.subscriptionOffer.findFirst({
    //       where: { stripePriceId: subscription.items.data[0].price.id },
    //     });
    //     planType = subscriptionOffer?.planType || SubscriptionPlanStatus.FREE;
    //   }

    //   // Get current_period_end from subscription items
    //   const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
    //   const subscriptionEndDate = currentPeriodEnd
    //     ? new Date(currentPeriodEnd * 1000)
    //     : new Date();

    //   // Handle scheduled cancellations (customer turned off auto-renewal)
    //   if (subscription.cancel_at_period_end) {
    //     await prisma.user.update({
    //       where: { id: user.id },
    //       data: {
    //         isSubscribed: true, // Still active until period ends
    //         subscriptionEnd: subscriptionEndDate,
    //         subscriptionPlan: planType,
    //       },
    //     });
    //     console.log(
    //       'Auto-renewal turned off - subscription continues until:',
    //       subscriptionEndDate,
    //     );
    //   }

    //   // Update user status regardless of cancellation type
    //   await prisma.user.update({
    //     where: { id: user.id },
    //     data: {
    //       isSubscribed: subscription.status === 'active',
    //       subscriptionEnd: subscriptionEndDate,
    //       subscriptionPlan: planType,
    //     },
    //   });

    //   // ONLY process refund if subscription is immediately canceled (not just auto-renewal turned off)
    //   if (
    //     subscription.status === 'canceled' &&
    //     !subscription.cancel_at_period_end
    //   ) {
    //     console.log('Immediate cancellation detected - processing refund');

    //     const paymentToUpdate = await prisma.payment.findFirst({
    //       where: {
    //         stripeSubscriptionId: subscription.id,
    //         status: PaymentStatus.COMPLETED,
    //       },
    //     });

    //     // Only attempt refund if we have a paymentIntentId and subscription was active
    //     if (paymentToUpdate?.paymentIntentId) {
    //       try {
    //         const refund = await stripe.refunds.create({
    //           payment_intent: paymentToUpdate.paymentIntentId,
    //         });
    //         console.log(
    //           'Refund processed for immediate cancellation:',
    //           refund.id,
    //         );
    //       } catch (refundError) {
    //         console.error('Refund failed:', refundError);
    //       }
    //     }

    //     // Update payment status to refunded
    //     await prisma.payment.updateMany({
    //       where: {
    //         stripeSubscriptionId: subscription.id,
    //         status: PaymentStatus.COMPLETED,
    //       },
    //       data: { status: PaymentStatus.REFUNDED },
    //     });

    //     // Update user subscription status
    //     await prisma.userSubscription.updateMany({
    //       where: {
    //         userId: user.id,
    //         stripeSubscriptionId: subscription.id,
    //       },
    //       data: {
    //         paymentStatus: PaymentStatus.REFUNDED,
    //         endDate: new Date(),
    //       },
    //     });
    //   }

    //   break;
    // }

    // case 'customer.subscription.deleted': {
    //   const subscription = event.data.object as Stripe.Subscription;

    //   console.log('Subscription deleted:', {
    //     subscriptionId: subscription.id,
    //     customerId: subscription.customer,
    //     status: subscription.status,
    //   });

    //   const user = await prisma.user.findFirst({
    //     where: { stripeCustomerId: subscription.customer as string },
    //   });

    //   if (!user) {
    //     console.error(
    //       'User not found for deleted subscription:',
    //       subscription.id,
    //     );
    //     break;
    //   }

    //   console.log('Processing subscription deletion for user:', user.id);

    //   // Mark subscription as canceled and remove access (NO REFUND)
    //   await prisma.user.update({
    //     where: { id: user.id },
    //     data: {
    //       isSubscribed: false,
    //       subscriptionEnd: new Date(), // Access ends immediately
    //       subscriptionPlan: SubscriptionPlanStatus.FREE,
    //     },
    //   });

    //   // Update UserSubscription to canceled status
    //   await prisma.userSubscription.update({
    //     where: {
    //       stripeSubscriptionId: subscription.id,
    //     },
    //     data: {
    //       endDate: new Date(),
    //       paymentStatus: PaymentStatus.CANCELLED,
    //     },
    //   });

    //   // Update Payment records to canceled status (NO REFUND)
    //   await prisma.payment.updateMany({
    //     where: {
    //       stripeSubscriptionId: subscription.id,
    //       status: PaymentStatus.COMPLETED,
    //     },
    //     data: {
    //       status: PaymentStatus.CANCELLED,
    //     },
    //   });

    //   console.log(
    //     'Subscription marked as canceled, access removed for user:',
    //     user.id,
    //   );
    //   break;
    // }

    case 'capability.updated':
      console.log('Capability updated event received. Handle accordingly.');
      break;

    // case 'invoice.payment_succeeded': {
    //   const invoice = event.data.object as any;
    //   const invoiceId = invoice.id;
    //   const paymentIntentId = invoice.payment_intent as string;
    //   const subscriptionId = invoice.subscription as string;
    //   const billingReason = invoice.billing_reason;

    //   console.log('Invoice payment succeeded:', {
    //     invoiceId,
    //     subscriptionId,
    //     paymentIntentId,
    //     billingReason,
    //   });

    //   if (!subscriptionId) {
    //     console.log('No subscription associated with this invoice');
    //     break;
    //   }

    //   try {
    //     // Retrieve subscription to get details
    //     const subscription =
    //       await stripe.subscriptions.retrieve(subscriptionId);

    //     // Get current_period_end from the first subscription item
    //     const currentPeriodEnd =
    //       subscription.items.data[0]?.current_period_end;

    //     if (!currentPeriodEnd) {
    //       console.error('No current_period_end found in subscription items');
    //       break;
    //     }

    //     const newEndDate = new Date(currentPeriodEnd * 1000);
    //     console.log('Extending subscription access until:', newEndDate);

    //     // Find the user and their subscription plan
    //     const user = await prisma.user.findFirst({
    //       where: { stripeCustomerId: subscription.customer as string },
    //     });

    //     if (!user) {
    //       console.error('User not found for subscription:', subscriptionId);
    //       break;
    //     }

    //     // Determine the plan type
    //     let planType: SubscriptionPlanStatus = SubscriptionPlanStatus.FREE;
    //     if (subscription.items.data.length > 0) {
    //       const subscriptionOffer = await prisma.subscriptionOffer.findFirst({
    //         where: { stripePriceId: subscription.items.data[0].price.id },
    //       });
    //       planType = subscriptionOffer?.planType ?? SubscriptionPlanStatus.FREE;
    //     }

    //     // Mark subscription as active and extend access
    //     await prisma.user.update({
    //       where: { id: user.id },
    //       data: {
    //         isSubscribed: true,
    //         subscriptionEnd: newEndDate,
    //         subscriptionPlan: planType,
    //       },
    //     });

    //     // Update UserSubscription record
    //     await prisma.userSubscription.updateMany({
    //       where: { stripeSubscriptionId: subscriptionId },
    //       data: {
    //         endDate: newEndDate,
    //         paymentStatus: PaymentStatus.COMPLETED,
    //       },
    //     });

    //     // Create or update payment record
    //     if (billingReason === 'subscription_cycle') {
    //       // Auto-renewal payment - create new payment record
    //       await prisma.payment.create({
    //         data: {
    //           stripeSubscriptionId: subscriptionId,
    //           invoiceId: invoiceId,
    //           paymentIntentId: paymentIntentId,
    //           paymentAmount: invoice.amount_paid
    //             ? invoice.amount_paid / 100
    //             : 0,
    //           amountProvider: user.stripeCustomerId || invoice.customer || '',
    //           status: PaymentStatus.COMPLETED,
    //           user: {
    //             connect: { id: user.id },
    //           },
    //         },
    //       });
    //       console.log('Created renewal payment record');
    //     } else if (billingReason === 'subscription_create') {
    //       // Initial payment - update existing payment record if needed
    //       const existingPayment = await prisma.payment.findFirst({
    //         where: {
    //           stripeSubscriptionId: subscriptionId,
    //           status: PaymentStatus.COMPLETED,
    //         },
    //       });

    //       if (existingPayment) {
    //         await prisma.payment.update({
    //           where: { id: existingPayment.id },
    //           data: {
    //             paymentIntentId: paymentIntentId,
    //             invoiceId: invoiceId,
    //           },
    //         });
    //         console.log('Updated initial payment with payment intent');
    //       }
    //     } else if (billingReason === 'subscription_update') {
    //       // Plan change - create new payment record
    //       await prisma.payment.create({
    //         data: {
    //           stripeSubscriptionId: subscriptionId,
    //           invoiceId: invoiceId,
    //           paymentIntentId: paymentIntentId,
    //           paymentAmount: invoice.amount_paid
    //             ? invoice.amount_paid / 100
    //             : 0,
    //           amountProvider: user.stripeCustomerId || invoice.customer || '',
    //           status: PaymentStatus.COMPLETED,
    //           user: {
    //             connect: { id: user.id },
    //           },
    //         },
    //       });
    //       console.log('Created plan update payment record');
    //     }

    //     console.log(
    //       'Subscription marked as active with extended access until:',
    //       newEndDate,
    //     );
    //   } catch (error) {
    //     console.error('Error processing invoice.payment_succeeded:', error);
    //   }
    //   break;
    // }

    // case 'invoice.upcoming': {
    //   const invoice = event.data.object as Stripe.Invoice;
    //   const customerId = invoice.customer as string;
    //   const subscriptionId = (invoice as any).subscription as string;
    //   const amountDue = invoice.amount_due / 100; // Convert to dollars
    //   const dueDate = invoice.due_date
    //     ? new Date(invoice.due_date * 1000)
    //     : null;

    //   // Get user and subscription details
    //   const user = await prisma.user.findFirst({
    //     where: { stripeCustomerId: customerId },
    //     include: {
    //       UserSubscription: { where: { stripeSubscriptionId: subscriptionId } },
    //     },
    //   });

    //   if (user && user.UserSubscription.length > 0 && dueDate) {
    //     const subscription = user.UserSubscription[0];

    //     // Send renewal reminder (email, push notification, etc.)
    //     //   await sendNotification(user.id, {
    //     //     type: 'SUBSCRIPTION_RENEWAL_REMINDER',
    //     //     message: `Your subscription for $${amountDue} will renew on ${dueDate.toLocaleDateString()}`,
    //     //     data: { subscriptionId, amountDue, dueDate }
    //     //   });
    //   }
    //   break;
    // }

    // case 'invoice.payment_failed': {
    //   const invoice = event.data.object as any;
    //   const subscriptionId = invoice.subscription as string;
    //   const customerId = invoice.customer as string;

    //   console.log('Invoice payment failed:', {
    //     invoiceId: invoice.id,
    //     subscriptionId,
    //     customerId,
    //     attemptCount: invoice.attempt_count,
    //   });

    //   if (!subscriptionId) {
    //     console.log('No subscription associated with failed invoice');
    //     break;
    //   }

    //   try {
    //     // Find the user
    //     const user = await prisma.user.findFirst({
    //       where: { stripeCustomerId: customerId },
    //     });

    //     if (!user) {
    //       console.error('User not found for failed payment:', customerId);
    //       break;
    //     }

    //     // Mark subscription as past_due and restrict premium access
    //     await prisma.user.update({
    //       where: { id: user.id },
    //       data: {
    //         isSubscribed: false, // Restrict premium access
    //       },
    //     });

    //     // Update UserSubscription to past_due status
    //     await prisma.userSubscription.updateMany({
    //       where: { stripeSubscriptionId: subscriptionId },
    //       data: {
    //         paymentStatus: PaymentStatus.PENDING, // Mark as pending/past_due
    //       },
    //     });

    //     // TODO: Send notification to user to update their payment method
    //     // await sendNotification(user.id, {
    //     //   type: 'PAYMENT_FAILED',
    //     //   message: 'Your subscription payment failed. Please update your payment method to continue enjoying premium features.',
    //     //   data: { subscriptionId, invoiceId: invoice.id }
    //     // });

    //     console.log(
    //       'Subscription marked as past_due, access restricted for user:',
    //       user.id,
    //     );
    //     console.log(
    //       'User should be notified to update their payment method',
    //     );
    //   } catch (error) {
    //     console.error('Error processing invoice.payment_failed:', error);
    //   }
    //   break;
    // }

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

const tipPaymentToBarber = catchAsync(async (req: any, res: any) => {
  const user = req.user as any;
  const result = await StripeServices.tipPaymentToBarberService(
    user.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Tip payment to barber successfully',
    data: result,
  });
});

const payoutToBarber = catchAsync(async (req: any, res: any) => {
  const result = await StripeServices.payoutToBarberService(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payout to barber successfully',
    data: result,
  });
});

const withdrawFundsFromStripe = catchAsync(
  async (req: any, res: any) => {
    const result = await StripeServices.withdrawFundsFromStripeService(
      req.body,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Withdraw funds from stripe successfully',
      data: result,
    });
  },
);

export const PaymentController = {
  saveCardWithCustomerInfo,
  authorizedPaymentWithSaveCard,
  capturePaymentRequest,
  saveNewCardWithExistingCustomer,
  getCustomerSavedCards,
  deleteCardFromCustomer,
  refundPaymentToCustomer,
  createPaymentIntent,
  cancelPaymentRequest,
  cancelQueuePaymentRequest,
  getCustomerDetails,
  getAllCustomers,
  createAccount,
  createNewAccount,
  tipPaymentToBarber,
  payoutToBarber,
  withdrawFundsFromStripe,
  handleWebHook,
};
