// import { admin } from 'firebase-admin';
import httpStatus from 'http-status';
import config from '../../../config';
import { isValidAmount } from '../../utils/isValidAmount';
import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import {
  UserRoleEnum,
  PaymentStatus,
  BookingStatus,
  QueueStatus,
} from '@prisma/client';
import Stripe from 'stripe';
import { TStripeSaveWithCustomerInfoPayload } from './payment.interface';
// import { notificationService } from '../Notification/Notification.service';

// Initialize Stripe with your secret API key
const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});

// Step 1: Create a Customer and Save the Card

const saveCardWithCustomerInfoIntoStripe = async (
  user: object & { id: string; name: string; email: string },
  payload: TStripeSaveWithCustomerInfoPayload,
) => {
  try {
    const { paymentMethodId } = payload;

    const userId = user.id;
    const findUserStripeId = await prisma.user.findUnique({
      where: {
        id: userId,
        role: UserRoleEnum.CUSTOMER,
        stripeCustomerId: { not: null },
      },
      select: {
        stripeCustomerId: true,
        fullName: true,
        email: true,
        address: true,
      },
    });

    if (!findUserStripeId?.stripeCustomerId) {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        name: user.name,
        email: user.email,
      });

      // Attach PaymentMethod to the Customer
      const attach = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });

      // Set PaymentMethod as Default
      const updateCustomer = await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // update profile with customerId
      await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          stripeCustomerId: customer.id,
        },
      });

      return {
        customerId: customer.id,
        paymentMethodId: paymentMethodId,
      };
    } else {
      // Attach PaymentMethod to the existing Customer
      const attach = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: findUserStripeId.stripeCustomerId,
      });

      // Set PaymentMethod as Default
      const updateCustomer = await stripe.customers.update(
        findUserStripeId.stripeCustomerId,
        {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        },
      );

      return {
        customerId: findUserStripeId.stripeCustomerId,
        paymentMethodId: paymentMethodId,
      };
    }
  } catch (error: any) {
    throw Error(error.message);
  }
};

// Step 2: Authorize the Payment Using Saved Card
const authorizeAndSplitPayment = async (
  userId: string,
  payload: {
    paymentMethodId: string;
    bookingId: string;
  },
) => {
  const { paymentMethodId, bookingId } = payload;

  return await prisma.$transaction(async tx => {
    const findBooking = await tx.booking.findUnique({
      where: { id: bookingId, status: BookingStatus.PENDING, userId: userId },
      include: {
        saloonOwner: {
          include: {
            user: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            address: true,
            stripeCustomerId: true,
          },
        },
      },
    });
    if (!findBooking) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Booking not found');
    }

    let customerId;

    if (!findBooking.user?.stripeCustomerId) {
      if (customerId) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        });
        console.log('customerId', customerId);
        console.log('paymentMethodId', paymentMethodId);

        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }

      if (!customerId) {
        const stripeCustomer = await stripe.customers.create({
          email: findBooking.user?.email
            ? findBooking.user?.email
            : (() => {
                throw new AppError(httpStatus.BAD_REQUEST, 'Email not found');
              })(),
        });

        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomer.id,
        });

        await stripe.customers.update(stripeCustomer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { stripeCustomerId: stripeCustomer.id },
        });

        customerId = stripeCustomer.id;
      }
    } else {
      customerId = findBooking.user?.stripeCustomerId;
    }

    let adminFeeAmount = 0.50 * 100; // £0.50 in pence

    let transferAmount = findBooking.totalPrice * 100; // Amount in pence
    
    const totalAmount = transferAmount + adminFeeAmount;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'gbp',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      metadata: {
        bookingId: findBooking.id,
        customerId: customerId,
        saloonOwnerId: findBooking.saloonOwner.user?.id as string,
      },
      capture_method: 'manual',
      transfer_data: {
        destination: findBooking.saloonOwner.user?.stripeAccountId as string,
        amount: transferAmount,
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    });

    if (paymentIntent.status === 'requires_capture') {
      const payment = await tx.payment.create({
        data: {
          userId: findBooking.saloonOwner.user?.id as string,
          bookingId: findBooking.id,
          paymentIntentId: paymentIntent.id,
          paymentAmount: transferAmount / 100,
          status: PaymentStatus.REQUIRES_CAPTURE,
          paymentMethodId: paymentMethodId,
          amountProvider: customerId,
          amountReceiver: findBooking.saloonOwner.user
            ?.stripeAccountId as string,
        },
      });

      if (!payment) {
        throw new AppError(
          httpStatus.CONFLICT,
          'Failed to save payment information',
        );
      }
      // Notification logic can be added here if needed
      // Send notification to the user
      // const user = await prisma.user.findUnique({
      //   where: { id: driver.id },
      //   select: { fcmToken: true, isNotificationOn: true },
      // });

      // const notificationTitle = 'Payment received successfully !';
      // const notificationBody = '';

      // if (user && user.fcmToken) {
      //   await notificationService.sendNotification(
      //     user.fcmToken,
      //     notificationTitle,
      //     notificationBody,
      //     driver.id,
      //   );
      // }
    }

    return paymentIntent;
  });
};

// Step 3: Capture the Payment
const capturePaymentRequestToStripe = async (
  userId: string,
  payload: {
    bookingId: string;
    status: string;
  },
) => {
  const { bookingId, status } = payload;
  return await prisma.$transaction(async tx => {
    const findBooking = await tx.booking.findUnique({
      where: {
        id: bookingId,
        saloonOwnerId: userId,
        status: BookingStatus.CONFIRMED,
      },
      include: {
        saloonOwner: {
          include: {
            user: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            address: true,
            stripeCustomerId: true,
          },
        },
      },
    });

    if (!findBooking) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Booking not found');
    }
    if (status === BookingStatus.COMPLETED) {
      await tx.barberRealTimeStatus.deleteMany({
        where: {
          barberId: findBooking.barberId,
          startDateTime: findBooking.startDateTime!,
          endDateTime: findBooking.endDateTime!,
        },
      });
      // update queueSlot status to completed
      await tx.queueSlot.updateMany({
        where: {
          bookingId: bookingId,
        },
        data: {
          status: QueueStatus.COMPLETED,
        },
      });
      await tx.queue.updateMany({
        where: {
          barberId: findBooking.barberId,
          saloonOwnerId: findBooking.saloonOwnerId,
          date: findBooking.date,
        },
        data: {
          currentPosition: {
            decrement: 1,
          },
        },
      });

      const findPayment = await tx.payment.findFirst({
        where: {
          bookingId: findBooking.id,
          status: PaymentStatus.REQUIRES_CAPTURE,
        },
      });

      if (!findPayment) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Payment record not found or already captured',
        );
      }
      if (!findPayment.paymentIntentId) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Payment Intent ID not found',
        );
      }

      const paymentIntent = await stripe.paymentIntents.capture(
        findPayment.paymentIntentId!,
      );

      if (paymentIntent.status === 'succeeded') {
        const updatePayment = await tx.payment.update({
          where: { id: findPayment.id },
          data: { status: PaymentStatus.COMPLETED },
        });

        if (!updatePayment) {
          throw new AppError(
            httpStatus.CONFLICT,
            'Failed to update payment information',
          );
        }

        const updateBooking = await tx.booking.update({
          where: { id: findBooking.id },
          data: { status: BookingStatus.COMPLETED },
        });
        if (!updateBooking) {
          throw new AppError(
            httpStatus.CONFLICT,
            'Failed to update booking status',
          );
        }
      }

      return paymentIntent;
    }
    if (status === BookingStatus.CANCELLED) {
      const findPayment = await tx.payment.findFirst({
        where: {
          bookingId: findBooking.id,
          status: PaymentStatus.REQUIRES_CAPTURE,
        },
      });

      if (!findPayment) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Payment record not found or already captured',
        );
      }
      if (!findPayment.paymentIntentId) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Payment Intent ID not found',
        );
      }

      const paymentIntent = await stripe.paymentIntents.cancel(
        findPayment.paymentIntentId!,
      );

      if (paymentIntent.status === 'canceled') {
        // Update payment status to REFUNDED

        await tx.barberRealTimeStatus.deleteMany({
          where: {
            barberId: findBooking.barberId,
            startDateTime: findBooking.startDateTime!,
            endDateTime: findBooking.endDateTime!,
          },
        });

        // update queueSlot status to cancelled
        await tx.queueSlot.updateMany({
          where: {
            bookingId: bookingId,
          },
          data: {
            status: QueueStatus.CANCELLED,
          },
        });
        await tx.queue.updateMany({
          where: {
            barberId: findBooking.barberId,
            saloonOwnerId: findBooking.saloonOwnerId,
            date: findBooking.date,
          },
          data: {
            currentPosition: {
              decrement: 1,
            },
          },
        });

        const updatePayment = await tx.payment.updateMany({
          where: {
            bookingId: findBooking.id,
            status: PaymentStatus.REQUIRES_CAPTURE,
          },
          data: { status: PaymentStatus.REFUNDED },
        });

        if (updatePayment.count === 0) {
          throw new AppError(
            httpStatus.CONFLICT,
            'Failed to update payment information',
          );
        }
        const updateBooking = await tx.booking.update({
          where: { id: findBooking.id },
          data: { status: BookingStatus.CANCELLED },
        });
        if (!updateBooking) {
          throw new AppError(
            httpStatus.CONFLICT,
            'Failed to update booking status',
          );
        }
        return updateBooking;
      }
    }
  });
};

const cancelPaymentRequestToStripe = async (
  userId: string,
  payload: {
    bookingId: string;
  },
) => {
  const { bookingId } = payload;
  return await prisma.$transaction(async tx => {
    const findBooking = await tx.booking.findUnique({
      where: {
        id: bookingId,
        saloonOwnerId: userId,
        status: BookingStatus.CONFIRMED,
      },
      include: {
        saloonOwner: {
          include: {
            user: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            address: true,
            stripeCustomerId: true,
          },
        },
      },
    });
    if (!findBooking) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Booking not found');
    }
    const findPayment = await tx.payment.findFirst({
      where: {
        bookingId: findBooking.id,
        status: PaymentStatus.REQUIRES_CAPTURE,
      },
    });
    if (!findPayment) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Payment record not found or already captured',
      );
    }
    if (!findPayment.paymentIntentId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Payment Intent ID not found');
    }
    const paymentIntent = await stripe.paymentIntents.cancel(
      findPayment.paymentIntentId!,
    );
    if (paymentIntent.status === 'canceled') {
      // Update payment status to REFUNDED
      await tx.barberRealTimeStatus.deleteMany({
        where: {
          barberId: findBooking.barberId,
          startDateTime: findBooking.startDateTime!,
          endDateTime: findBooking.endDateTime!,
        },
      });
      // update queueSlot status to cancelled
      await tx.queueSlot.updateMany({
        where: {
          bookingId: bookingId,
        },
        data: {
          status: QueueStatus.CANCELLED,
        },
      });
      await tx.queue.updateMany({
        where: {
          barberId: findBooking.barberId,
          saloonOwnerId: findBooking.saloonOwnerId,
          date: findBooking.date,
        },
        data: {
          currentPosition: {
            decrement: 1,
          },
        },
      });
      const updatePayment = await tx.payment.updateMany({
        where: {
          bookingId: findBooking.id,
          status: PaymentStatus.REQUIRES_CAPTURE,
        },
        data: { status: PaymentStatus.REFUNDED },
      });
      if (updatePayment.count === 0) {
        throw new AppError(
          httpStatus.CONFLICT,
          'Failed to update payment information',
        );
      }
      const updateBooking = await tx.booking.update({
        where: { id: findBooking.id },
        data: { status: BookingStatus.CANCELLED },
      });
      if (!updateBooking) {
        throw new AppError(
          httpStatus.CONFLICT,
          'Failed to update booking status',
        );
      }
      return updateBooking;
    }
  });
};

const SERVICE_FEE_PENCE = 50; // £0.50

const cancelQueuePaymentRequestToStripe = async (
  userId: string,
  payload: { bookingId: string },
) => {
  const { bookingId } = payload;

  return await prisma.$transaction(async tx => {
    /* ---------------------------------------------------- */
    /* 1 Validate Booking                                */
    /* ---------------------------------------------------- */

    const findBooking = await tx.booking.findUnique({
      where: {
        id: bookingId,
        saloonOwnerId: userId,
        status: BookingStatus.CONFIRMED,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            stripeCustomerId: true,
          },
        },
      },
    });

    if (!findBooking) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Booking not found');
    }

    /* ---------------------------------------------------- */
    /* 2 Validate Payment                                */
    /* ---------------------------------------------------- */

    const findPayment = await tx.payment.findFirst({
      where: {
        bookingId: findBooking.id,
        status: {
          in: [
            PaymentStatus.REQUIRES_CAPTURE,
            PaymentStatus.COMPLETED,
          ],
        },
      },
    });

    if (!findPayment) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Payment record not found',
      );
    }

    if (!findPayment.paymentIntentId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Payment Intent ID missing',
      );
    }

    /* ---------------------------------------------------- */
    /* 3 Get PaymentIntent from Stripe                   */
    /* ---------------------------------------------------- */

    const paymentIntent = await stripe.paymentIntents.retrieve(
      findPayment.paymentIntentId,
    );

    const totalAmount = paymentIntent.amount;

    if (!totalAmount || totalAmount <= 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Invalid payment amount',
      );
    }

    /* ---------------------------------------------------- */
    /* 4 CASE A: Payment Requires Capture                */
    /* ---------------------------------------------------- */

    if (paymentIntent.status === 'requires_capture') {
      const captureAmount = Math.min(
        SERVICE_FEE_PENCE,
        totalAmount,
      );

      const captured = await stripe.paymentIntents.capture(
        findPayment.paymentIntentId,
        {
          amount_to_capture: captureAmount,
        },
      );

      if (captured.status !== 'succeeded') {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Failed to capture service fee',
        );
      }

      await tx.payment.update({
        where: { id: findPayment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          paymentAmount: captureAmount,
        },
      });
    }

    /* ---------------------------------------------------- */
    /* 5 CASE B: Payment Already Captured                */
    /* ---------------------------------------------------- */

    else if (paymentIntent.status === 'succeeded') {
      const refundAmount = Math.max(
        0,
        totalAmount - SERVICE_FEE_PENCE,
      );

      if (refundAmount > 0) {
        await stripe.refunds.create({
          payment_intent: findPayment.paymentIntentId,
          amount: refundAmount,
        });
      }

      await tx.payment.update({
        where: { id: findPayment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          paymentAmount: refundAmount,
        },
      });
    }

    /* ---------------------------------------------------- */
    /* 6 Update Queue + Booking                          */
    /* ---------------------------------------------------- */

    await tx.barberRealTimeStatus.deleteMany({
      where: {
        barberId: findBooking.barberId,
        startDateTime: findBooking.startDateTime!,
        endDateTime: findBooking.endDateTime!,
      },
    });

    await tx.queueSlot.updateMany({
      where: { bookingId },
      data: { status: QueueStatus.CANCELLED },
    });

    await tx.queue.updateMany({
      where: {
        barberId: findBooking.barberId,
        saloonOwnerId: findBooking.saloonOwnerId,
        date: findBooking.date,
      },
      data: {
        currentPosition: {
          decrement: 1,
        },
      },
    });

    const updateBooking = await tx.booking.update({
      where: { id: findBooking.id },
      data: { status: BookingStatus.CANCELLED },
    });

    return updateBooking;
  });
};

// New Route: Save a New Card for Existing Customer
const saveNewCardWithExistingCustomerIntoStripe = async (payload: {
  customerId: string;
  paymentMethodId: string;
}) => {
  // try {
  //   const { customerId, paymentMethodId } = payload;
  //   // Attach the new PaymentMethod to the existing Customer
  //   await stripe.paymentMethods.attach(paymentMethodId, {
  //     customer: customerId,
  //   });
  //   // Optionally, set the new PaymentMethod as the default
  //   await stripe.customers.update(customerId, {
  //     invoice_settings: {
  //       default_payment_method: paymentMethodId,
  //     },
  //   });
  //   return {
  //     customerId: customerId,
  //     paymentMethodId: paymentMethodId,
  //   };
  // } catch (error: any) {
  //   throw new AppError(httpStatus.CONFLICT, error.message);
  // }
};

const getCustomerSavedCardsFromStripe = async (userId: string) => {
  // try {
  //   const userData = await prisma.user.findUnique({
  //     where: { id: userId },
  //   });
  //   // Retrieve the customer details from Stripe
  //   if (!userData || !userData.senderCustomerID) {
  //     return { message: 'User data or customer ID not found' };
  //   }
  //   // List all payment methods for the customer
  //   const paymentMethods = await stripe.paymentMethods.list({
  //     customer: userData.senderCustomerID,
  //     type: 'card',
  //   });
  //   return { paymentMethods: paymentMethods.data };
  // } catch (error: any) {
  //   throw new AppError(httpStatus.CONFLICT, error.message);
  // }
};

// Delete a card from a customer in the stripe
const deleteCardFromCustomer = async (paymentMethodId: string) => {
  // try {
  //   await stripe.paymentMethods.detach(paymentMethodId);
  //   return { message: 'Card deleted successfully' };
  // } catch (error: any) {
  //   throw new AppError(httpStatus.CONFLICT, error.message);
  // }
};

// Refund amount to customer in the stripe
const refundPaymentToCustomer = async (payload: {
  paymentIntentId: string;
}) => {
  // try {
  //   // Refund the payment intent
  //   const refund = await stripe.refunds.create({
  //     payment_intent: payload?.paymentIntentId,
  //   });
  //   return refund;
  // } catch (error: any) {
  //   throw new AppError(httpStatus.CONFLICT, error.message);
  // }
};

// Service function for creating a PaymentIntent
const createPaymentIntentService = async (payload: { amount: number }) => {
  // if (!payload.amount) {
  //   throw new AppError(httpStatus.CONFLICT, 'Amount is required');
  // }
  // if (!isValidAmount(payload.amount)) {
  //   throw new AppError(
  //     httpStatus.CONFLICT,
  //     `Amount '${payload.amount}' is not a valid amount`,
  //   );
  // }
  // // Create a PaymentIntent with Stripe
  // const paymentIntent = await stripe.paymentIntents.create({
  //   amount: payload?.amount,
  //   currency: 'gbp',
  //   automatic_payment_methods: {
  //     enabled: true, // Enable automatic payment methods like cards, Apple Pay, Google Pay
  //   },
  // });
  // return {
  //   clientSecret: paymentIntent.client_secret,
  //   dpmCheckerLink: `https://dashboard.stripe.com/settings/payment_methods/review?transaction_id=${paymentIntent.id}`,
  // };
};

const getCustomerDetailsFromStripe = async (userId: string) => {
  // try {
  //   const userData = await prisma.user.findUnique({
  //     where: { id: userId },
  //   });
  //   // Retrieve the customer details from Stripe
  //   if (!userData || !userData.senderCustomerID) {
  //     return { message: 'User data or customer ID not found' };
  //   }
  //   const customer = await stripe.customers.retrieve(userData.senderCustomerID);
  //   return customer;
  // } catch (error: any) {
  //   throw new AppError(httpStatus.NOT_FOUND, error.message);
  // }
};

const getAllCustomersFromStripe = async () => {
  // try {
  //   // Retrieve all customers from Stripe
  //   const customers = await stripe.customers.list({
  //     limit: 2,
  //   });
  //   return customers;
  // } catch (error: any) {
  //   throw new AppError(httpStatus.CONFLICT, error.message);
  // }
};

const createAccountIntoStripe = async (userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (userData.stripeAccountUrl && userData.stripeCustomerId) {
    const stripeAccountId = userData.stripeCustomerId;
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${config.backend_base_url}/reauthenticate`,
      return_url: `${config.backend_base_url}/onboarding-success`,
      type: 'account_onboarding',
    });

    await prisma.user.update({
      where: { id: userData.id },
      data: {
        stripeAccountUrl: accountLink.url,
      },
    });

    return accountLink;
  }

  // Create a Stripe Connect account
  const stripeAccount = await stripe.accounts.create({
    type: 'express',
    email: userData.email,
    metadata: {
      userId: userData.id,
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  // Generate the onboarding link for the Stripe Express account
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccount.id,
    refresh_url: `${config.backend_base_url}/reauthenticate.html`,
    return_url: `${config.backend_base_url}/onboarding-success.html`,
    type: 'account_onboarding',
  });

  const stripeAccountId = stripeAccount.id;

  // Save both Stripe customerId and accountId in the database
  const updateUser = await prisma.user.update({
    where: { id: userData.id },
    data: {
      stripeAccountUrl: accountLink.url,
      stripeAccountId: stripeAccountId,
    },
  });

  if (!updateUser) {
    throw new AppError(httpStatus.CONFLICT, 'Failed to save account details');
  }

  return accountLink;
};

const createNewAccountIntoStripe = async (userId: string) => {
  // Fetch user data from the database
  const userData = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  let stripeAccountId = userData.stripeAccountId;

  // If the user already has a Stripe account, delete it
  if (stripeAccountId) {
    await stripe.accounts.del(stripeAccountId); // Delete the old account
  }

  // Create a new Stripe account
  const newAccount = await stripe.accounts.create({
    type: 'express',
    email: userData.email, // Use the user's email from the database
    country: 'UK', // Set the country dynamically if needed
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      userId: userData.id, // Add metadata for reference
    },
  });

  // Generate the onboarding link for the new Stripe account
  const accountLink = await stripe.accountLinks.create({
    account: newAccount.id,
    refresh_url: `${config.frontend_base_url}/reauthenticate`,
    return_url: `${config.frontend_base_url}/onboarding-success`,
    type: 'account_onboarding',
  });

  // Update the user's Stripe account ID and URL in the database
  await prisma.user.update({
    where: { id: userData.id },
    data: {
      stripeAccountId: newAccount.id,
      stripeAccountUrl: accountLink.url,
    },
  });

  return accountLink;
};

const tipPaymentToBarberService = async (
  userId: string,
  payload: {
    bookingId: string;
    barberAmount: number;
    saloonOwnerAmount: number;
    paymentMethodId: string;
  },
) => {
  const { bookingId, barberAmount, saloonOwnerAmount, paymentMethodId } =
    payload;

  if (!isValidAmount(barberAmount) || !isValidAmount(saloonOwnerAmount)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid amount. Amount must be positive with up to 2 decimals.',
    );
  }

  return await prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId, status: BookingStatus.COMPLETED, userId },
      include: {
        saloonOwner: { include: { user: true } },
        barber: { include: { user: true } },
        user: { select: { id: true, stripeCustomerId: true } },
      },
    });
    if (!booking)
      throw new AppError(httpStatus.BAD_REQUEST, 'Booking not found');
    if (!booking.user?.stripeCustomerId)
      throw new AppError(httpStatus.BAD_REQUEST, 'Customer has no Stripe ID');
    if (!booking.saloonOwner.user?.stripeAccountId)
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Saloon owner missing Stripe account ID',
      );
    if (!booking.barber.user?.stripeAccountId)
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Barber missing Stripe account ID',
      );

    const totalAmount = barberAmount + saloonOwnerAmount;
    const serviceCharge = totalAmount * 0.001; // 0.1% service fee
    const finalAmount = totalAmount + serviceCharge;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(finalAmount * 100), // in pence
      currency: 'gbp',
      customer: booking.user.stripeCustomerId,
      payment_method: paymentMethodId,
      confirm: true,
      metadata: {
        bookingId: booking.id,
        customerId: booking.user.id,
        saloonOwnerId: booking.saloonOwner.user.id,
        barberId: booking.barber.user.id,
      },
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });

    if (paymentIntent.status === 'succeeded') {
      // Transfer to saloon owner
      await stripe.transfers.create({
        amount: Math.round(saloonOwnerAmount * 100),
        currency: 'gbp',
        destination: booking.saloonOwner.user.stripeAccountId,
        metadata: { bookingId: booking.id, role: 'saloon_owner' },
      });

      // Transfer to barber
      await stripe.transfers.create({
        amount: Math.round(barberAmount * 100),
        currency: 'gbp',
        destination: booking.barber.user.stripeAccountId,
        metadata: { bookingId: booking.id, role: 'barber' },
      });

      // DB payments
      await tx.payment.createMany({
        data: [
          {
            userId: booking.saloonOwner.user.id,
            bookingId: booking.id,
            paymentIntentId: paymentIntent.id,
            paymentAmount: saloonOwnerAmount,
            status: PaymentStatus.COMPLETED,
            paymentMethodId,
            amountProvider: booking.user.stripeCustomerId!,
            amountReceiver: booking.saloonOwner.user.stripeAccountId!,
          },
          {
            userId: booking.barber.user.id,
            bookingId: booking.id,
            paymentIntentId: paymentIntent.id,
            paymentAmount: barberAmount,
            status: PaymentStatus.COMPLETED,
            paymentMethodId,
            amountProvider: booking.user.stripeCustomerId!,
            amountReceiver: booking.barber.user.stripeAccountId!,
          },
        ],
      });
    }

    return paymentIntent;
  });
};

const payoutToBarberService = async (payload: {
  barberId: string;
  amount: number;
  currency: string;
}) => {
  // try {
  //   const { barberId, amount, currency } = payload;

  //   // Fetch barber's Stripe account ID from your database
  //   const barber = await prisma.user.findUnique({
  //     where: { id: barberId },
  //   });

  //   if (!barber || !barber.stripeAccountId) {
  //     throw new AppError(httpStatus.NOT_FOUND, 'Barber or Stripe account not found');
  //   }

  //   // Create a payout to the barber's Stripe account
  //   const transfer = await stripe.transfers.create({
  //     amount: Math.round(amount * 100), // Amount in cents
  //     currency: currency,
  //     destination: barber.stripeAccountId,
  //   });

  //   return transfer;
  // } catch (error: any) {
  //   throw new AppError(httpStatus.CONFLICT, error.message);
  // }
};

const withdrawFundsFromStripeService = async (userId: string) => {
  // try {
  //   const userData = await prisma.user.findUnique({
  //     where: { id: userId },
  //   });
  
  //   if (!userData || !userData.stripeAccountId) {
  //     throw new AppError(httpStatus.NOT_FOUND, 'User data or Stripe account ID not found');
  //   }
  
  //   // Create a payout from the Stripe account to the user's bank account
  //   const payout = await stripe.payouts.create(
  //     {
  //       amount: 1000, // Amount in pence (e.g., £10.00)
  //       currency: 'gbp',
  //     },
  //     {
  //       stripeAccount: userData.stripeAccountId,
  //     }
  //   );
  //   return payout;
  // } catch (error: any) {
  //   throw new AppError(httpStatus.CONFLICT, error.message);
  // }
}
export const StripeServices = {
  saveCardWithCustomerInfoIntoStripe,
  authorizeAndSplitPayment,
  capturePaymentRequestToStripe,
  saveNewCardWithExistingCustomerIntoStripe,
  getCustomerSavedCardsFromStripe,
  deleteCardFromCustomer,
  refundPaymentToCustomer,
  createPaymentIntentService,
  getCustomerDetailsFromStripe,
  getAllCustomersFromStripe,
  createAccountIntoStripe,
  createNewAccountIntoStripe,
  tipPaymentToBarberService,
  payoutToBarberService,
  withdrawFundsFromStripeService,
  cancelPaymentRequestToStripe,
  cancelQueuePaymentRequestToStripe
};


