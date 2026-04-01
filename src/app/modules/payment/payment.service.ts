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
  BookingType,
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

    let finalCustomerId: string;

    if (!findUserStripeId?.stripeCustomerId) {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        name: user.name,
        email: user.email,
      });

      // Attach PaymentMethod to the Customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });

      // Set PaymentMethod as Default
      await stripe.customers.update(customer.id, {
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

      finalCustomerId = customer.id;
    } else {
      // Validate that the stored customer ID exists in Stripe
      let customerExists = true;
      try {
        await stripe.customers.retrieve(findUserStripeId.stripeCustomerId);
      } catch (error: any) {
        if (error.code === 'resource_missing' || error.message.includes('No such customer')) {
          customerExists = false;
          console.warn(`Stripe customer ${findUserStripeId.stripeCustomerId} not found. Creating new customer.`);
        } else {
          throw error;
        }
      }

      if (!customerExists) {
        // Customer doesn't exist, create a new one
        const customer = await stripe.customers.create({
          name: user.name,
          email: user.email,
        });

        // Attach PaymentMethod to the new Customer
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customer.id,
        });

        // Set PaymentMethod as Default
        await stripe.customers.update(customer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });

        // Update profile with new customerId
        await prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            stripeCustomerId: customer.id,
          },
        });

        finalCustomerId = customer.id;
      } else {
        // Attach PaymentMethod to the existing Customer
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: findUserStripeId.stripeCustomerId,
        });

        // Set PaymentMethod as Default
        await stripe.customers.update(
          findUserStripeId.stripeCustomerId,
          {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          },
        );

        finalCustomerId = findUserStripeId.stripeCustomerId;
      }
    }

    return {
      customerId: finalCustomerId,
      paymentMethodId: paymentMethodId,
    };
  } catch (error: any) {
    throw Error(error.message);
  }
};

// Step 2: Create Checkout Session for Authorization (Webhook will handle Payment record creation)
const authorizeAndSplitPayment = async (
  userId: string,
  payload: {
    bookingId: string;
    booking?: any; // Optional: pass the booking object directly to avoid querying
    tx?: any; // Optional: pass transaction client to avoid nested transactions
  },
) => {
  const { bookingId, booking: passedBooking, tx: transactionClient } = payload;

  // Use provided transaction or create a new one
  const executeInTransaction = transactionClient ? 
    async (callback: (txClient: any) => Promise<any>) => callback(transactionClient) :
    async (callback: (txClient: any) => Promise<any>) => prisma.$transaction(callback);

  return await executeInTransaction(async (tx) => {
    // Use passed booking if available, otherwise query for it
    let findBooking = passedBooking;
    if (!findBooking) {
      findBooking = await tx.booking.findUnique({
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
    } else {
      // If booking is passed without relations, fetch the missing user data
      if (!findBooking.user) {
        const userWithEmail = await tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            address: true,
            stripeCustomerId: true,
          },
        });
        findBooking.user = userWithEmail;
      }

      // Fetch saloon owner if not included
      if (!findBooking.saloonOwner) {
        findBooking.saloonOwner = await tx.saloonOwner.findUnique({
          where: { userId: findBooking.saloonOwnerId },
          include: {
            user: true,
          },
        });
      }
    }

    console.log('Booking found for payment authorization:', findBooking.user);

    if (!findBooking) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Booking not found');
    }

    if (!findBooking.user?.email) {
      throw new AppError(httpStatus.BAD_REQUEST, 'User email not found');
    }

    // Get or create Stripe customer
    let customerId = findBooking.user?.stripeCustomerId;

    if (!customerId || customerId === null) {
      const stripeCustomer = await stripe.customers.create({
        email: findBooking.user?.email
          ? findBooking.user?.email
          : (() => {
              throw new AppError(httpStatus.BAD_REQUEST, 'Email not found');
              
            })(),
      });

      await tx.user.update({
        where: { id: userId },
        data: { stripeCustomerId: stripeCustomer.id },
      });

      customerId = stripeCustomer.id;
    } else {
      // Validate that the stored customer ID actually exists in Stripe
      // This handles cases where Stripe API key changed or account switched
      try {
        await stripe.customers.retrieve(customerId);
      } catch (error: any) {
        if (error.code === 'resource_missing' || error.message.includes('No such customer')) {
          console.warn(`Stripe customer ${customerId} not found. Creating new customer.`);
          
          // Customer doesn't exist in this Stripe account, create a new one
          const stripeCustomer = await stripe.customers.create({
            email: findBooking.user?.email
              ? findBooking.user?.email
              : (() => {
                  throw new AppError(httpStatus.BAD_REQUEST, 'Email not found');
                })(),
          });

          // Update user profile with new customer ID
          await tx.user.update({
            where: { id: userId },
            data: { stripeCustomerId: stripeCustomer.id },
          });

          customerId = stripeCustomer.id;
        } else {
          // Re-throw other Stripe errors
          throw error;
        }
      }
    }

    let adminFeeAmount = 0.50 * 100; // £0.50 in pence
    let transferAmount = findBooking.totalPrice * 100; // Amount in pence
    const totalAmount = transferAmount + adminFeeAmount;

    // Validate that the saloon owner's Stripe connected account exists
    let destinationAccountId = findBooking.saloonOwner.user?.stripeAccountId;
    
    if (!destinationAccountId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Saloon owner has not connected their Stripe account'
      );
    }

    // Verify the destination account exists in current Stripe account
    try {
      await stripe.accounts.retrieve(destinationAccountId);
    } catch (error: any) {
      if (error.code === 'resource_missing' || error.message.includes('No such account')) {
        console.warn(`Stripe account ${destinationAccountId} not found for destination transfer.`);
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Saloon owner Stripe account is no longer valid. Please reconnect your Stripe account.'
        );
      } else {
        // Re-throw other Stripe errors
        throw error;
      }
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer: customerId,
      client_reference_id: bookingId,
      success_url: `${config.frontend_base_url}/booking/${bookingId}/success`,
      cancel_url: `${config.frontend_base_url}/booking/${bookingId}/cancel`,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Booking Service #${bookingId}`,
            },
            unit_amount: totalAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId: findBooking.id,
        customerId: customerId,
        saloonOwnerId: findBooking.saloonOwner.user?.id,
        transferAmount: String(transferAmount),
        adminFeeAmount: String(adminFeeAmount),
        barberStripeAccountId: findBooking.saloonOwner.user?.stripeAccountId,
      },
      payment_intent_data: {
        capture_method: 'manual',
        transfer_data: {
          destination: destinationAccountId,
          amount: transferAmount,
        },
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
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
        userId: userId,
        bookingType: BookingType.QUEUE,
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
    /* 2 Check Five-Minute Decision Window                */
    /* ---------------------------------------------------- */

    const now = new Date();
    const minutesElapsedSinceQueueAddition =
      (now.getTime() - findBooking.createdAt.getTime()) / (1000 * 60);
    const isWithinFiveMinutes = minutesElapsedSinceQueueAddition <= 5;

    /* ---------------------------------------------------- */
    /* 3 Validate Payment                                */
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
    /* 4 Get PaymentIntent from Stripe                   */
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
    /* 5 Handle Cancellation Based on Time Window        */
    /* ---------------------------------------------------- */

    if (isWithinFiveMinutes) {
      // WITHIN 5 MINS: Refund (totalAmount - £0.50)
      
      if (paymentIntent.status === 'requires_capture') {
        // Cancel the intent (auto-refunds authorized amount)
        await stripe.paymentIntents.cancel(
          findPayment.paymentIntentId,
        );
      } else if (paymentIntent.status === 'succeeded') {
        // Create refund for amount minus service fee
        const refundAmount = Math.max(0, totalAmount - SERVICE_FEE_PENCE);
        if (refundAmount > 0) {
          await stripe.refunds.create({
            payment_intent: findPayment.paymentIntentId,
            amount: refundAmount,
          });
        }
      }

      await tx.payment.update({
        where: { id: findPayment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          paymentAmount: SERVICE_FEE_PENCE,
        },
      });
    } else {
      // AFTER 5 MINS: No refund, admin keeps £0.50, shop owner gets the rest
      
      if (paymentIntent.status === 'requires_capture') {
        // Capture full amount (transfer_data will send shop owner's portion)
        const captured = await stripe.paymentIntents.confirm(
          findPayment.paymentIntentId,
        );

        if (captured.status !== 'succeeded') {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Failed to capture payment',
          );
        }
      }
      // If already succeeded, do nothing - payment already captured

      await tx.payment.update({
        where: { id: findPayment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          paymentAmount: totalAmount,
        },
      });
    }

    /* ---------------------------------------------------- */
    /* 7 Update Queue + Booking                          */
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

  // Opportunistic cleanup: Remove abandoned pending account if older than 7 days
  if (userData.stripeAccountIdPending) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    if (userData.updatedAt < sevenDaysAgo) {
      try {
        console.log(
          `🧹 Cleaning up abandoned pending account ${userData.stripeAccountIdPending} for user ${userId}`,
        );
        
        // Delete the abandoned pending account from Stripe
        await stripe.accounts.del(userData.stripeAccountIdPending);
        
        // Clear pending account from DB
        await prisma.user.update({
          where: { id: userId },
          data: { stripeAccountIdPending: null },
        });
        
        console.log(`✅ Cleaned up abandoned pending Stripe account for user ${userId}`);
      } catch (cleanupError: any) {
        console.error(
          `⚠️ Failed to cleanup abandoned pending account: ${cleanupError.message}`,
        );
        // Continue anyway - this doesn't block creating new account
      }
    }
  }

  // Create a new Stripe account (DO NOT delete old one yet)
  const newAccount = await stripe.accounts.create({
    type: 'express',
    email: userData.email,
    country: 'GB',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      userId: userData.id,
    },
  });

  // Generate the onboarding link for the new Stripe account
  const accountLink = await stripe.accountLinks.create({
    account: newAccount.id,
    refresh_url: `${config.frontend_base_url}/reauthenticate`,
    return_url: `${config.frontend_base_url}/onboarding-success`,
    type: 'account_onboarding',
  });

  // Store new account in PENDING field until webhook confirms onboarding
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeAccountIdPending: newAccount.id,
      stripeAccountUrl: accountLink.url,
    },
  });

  // Return account link - old account remains active for payments
  return {
    accountLink: accountLink.url,
    stripeAccountId: newAccount.id,
    message: 'Complete onboarding to activate the new account. Previous account remains active for ongoing transactions.',
  };
};

// Cleanup abandoned pending Stripe accounts older than 7 days
const cleanupAbandonedPendingAccounts = async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const usersWithPendingAccounts = await prisma.user.findMany({
    where: {
      stripeAccountIdPending: { not: null },
      updatedAt: { lt: sevenDaysAgo },
    },
    select: {
      id: true,
      stripeAccountIdPending: true,
      email: true,
      updatedAt: true,
    },
  });

  const deletedResults = [];

  for (const user of usersWithPendingAccounts) {
    try {
      console.log(`Cleaning up abandoned Stripe account ${user.stripeAccountIdPending} for user ${user.id}`);
      
      // Delete the abandoned pending account from Stripe
      await stripe.accounts.del(user.stripeAccountIdPending!);

      // Clear the pending account from DB
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeAccountIdPending: null },
      });

      deletedResults.push({
        userId: user.id,
        email: user.email,
        stripeAccountId: user.stripeAccountIdPending,
        status: 'cleaned_up',
        updatedAt: user.updatedAt,
      });
    } catch (error: any) {
      console.error(`Failed to cleanup pending account for user ${user.id}:`, error.message);
      deletedResults.push({
        userId: user.id,
        email: user.email,
        stripeAccountId: user.stripeAccountIdPending,
        status: 'failed',
        error: error.message,
      });
    }
  }

  return {
    message: `Cleanup completed for ${usersWithPendingAccounts.length} users`,
    results: deletedResults,
  };
};

const tipPaymentToBarberService = async (
  userId: string,
  payload: {
    bookingId: string;
    barberAmount?: number;
    saloonOwnerAmount?: number;
  },
) => {
  const { bookingId, barberAmount = 0, saloonOwnerAmount = 0 } = payload;

  // Validate that at least one amount is provided and valid
  if ((barberAmount === 0 && saloonOwnerAmount === 0) || (!isValidAmount(barberAmount) && !isValidAmount(saloonOwnerAmount))) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'At least one valid tip amount must be provided. Amount must be positive with up to 2 decimals.',
    );
  }

  // Validate individual amounts if provided
  if (barberAmount > 0 && !isValidAmount(barberAmount)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid barber tip amount. Amount must be positive with up to 2 decimals.',
    );
  }

  if (saloonOwnerAmount > 0 && !isValidAmount(saloonOwnerAmount)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid shop owner tip amount. Amount must be positive with up to 2 decimals.',
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId, status: BookingStatus.COMPLETED, userId },
    include: {
      saloonOwner: { include: { user: true } },
      barber: { include: { user: true } },
      user: { select: { id: true, stripeCustomerId: true, email: true } },
    },
  });

  if (!booking)
    throw new AppError(httpStatus.BAD_REQUEST, 'Booking not found');
  if (!booking.user?.stripeCustomerId)
    throw new AppError(httpStatus.BAD_REQUEST, 'Customer has no Stripe ID');
  
  // Only validate account IDs for the recipients being tipped
  if (saloonOwnerAmount > 0 && !booking.saloonOwner.user?.stripeAccountId)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Saloon owner missing Stripe account ID',
    );
  if (barberAmount > 0 && !booking.barber.user?.stripeAccountId)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Barber missing Stripe account ID',
    );

  const totalAmount = barberAmount + saloonOwnerAmount;
  const TIP_FEE_PENCE = 10; // £0.10 fixed tip fee per recipient - deducted only if amount is provided

  // Actual amounts to transfer (fee deducted only for provided amounts)
  const barberActualAmount = barberAmount > 0 ? Math.max(0, barberAmount - (TIP_FEE_PENCE / 100)) : 0;
  const saloonOwnerActualAmount = saloonOwnerAmount > 0 ? Math.max(0, saloonOwnerAmount - (TIP_FEE_PENCE / 100)) : 0;

  // Customer pays the tip amounts without any additional fee
  const finalAmount = totalAmount;

  // Validate destination accounts exist before creating checkout session
  const saloonOwnerAccountId = booking.saloonOwner.user?.stripeAccountId;
  const barberAccountId = booking.barber.user?.stripeAccountId;

  try {
    // Only validate accounts for recipients being tipped
    if (saloonOwnerAmount > 0 && saloonOwnerAccountId) {
      await stripe.accounts.retrieve(saloonOwnerAccountId);
    }
    if (barberAmount > 0 && barberAccountId) {
      await stripe.accounts.retrieve(barberAccountId);
    }
  } catch (error: any) {
    if (error.code === 'resource_missing' || error.message.includes('No such account')) {
      const invalidAccount = saloonOwnerAccountId === error.param?.split('[')[1] 
        ? 'Saloon owner' 
        : 'Barber';
      console.warn(`Stripe account not found for ${invalidAccount} transfer.`);
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `${invalidAccount} Stripe account is no longer valid. Please reconnect your Stripe account.`
      );
    } else {
      throw error;
    }
  }

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer: booking.user.stripeCustomerId,
    client_reference_id: bookingId,
    success_url: `${config.frontend_base_url}/booking/${bookingId}/tip-success`,
    cancel_url: `${config.frontend_base_url}/booking/${bookingId}/tip-cancel`,
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `Tip - Booking #${bookingId}`,
          },
          unit_amount: Math.round(finalAmount * 100), // in pence
        },
        quantity: 1,
      },
    ],
    metadata: {
      bookingId: booking.id,
      customerId: booking.user.id,
      saloonOwnerId: booking.saloonOwner.user.id,
      barberId: booking.barber.user.id,
      barberOriginalAmount: String(barberAmount),
      saloonOwnerOriginalAmount: String(saloonOwnerAmount),
      barberActualAmount: String(barberActualAmount),
      saloonOwnerActualAmount: String(saloonOwnerActualAmount),
      tipFee: String(TIP_FEE_PENCE / 100),
      barberStripeAccountId: barberAccountId,
      saloonOwnerStripeAccountId: saloonOwnerAccountId,
      barberTipped: String(barberAmount > 0),
      saloonOwnerTipped: String(saloonOwnerAmount > 0),
    },
  });

  return {
    sessionId: session.id,
    url: session.url,
  };
};

const payoutToBarberService = async (
  userId: string,
  payload: {
    barberId: string;
    amount: number;
  },
) => {
  const { barberId, amount } = payload;

  // Validate amount
  if (!amount || amount <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Amount must be greater than 0',
    );
  }

  if (!isValidAmount(amount)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid amount. Amount must be positive with up to 2 decimals.',
    );
  }

  // Get saloon owner (user making the payout)
  const saloonOwner = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      SaloonOwner: {
        select: { userId: true },
      },
    },
  });

  if (!saloonOwner) {
    throw new AppError(httpStatus.NOT_FOUND, 'Saloon owner not found');
  }

  // Verify user is a saloon owner
  if (!saloonOwner.SaloonOwner || saloonOwner.SaloonOwner.length === 0) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'User is not a saloon owner',
    );
  }

  // Verify saloon owner has valid Stripe account
  if (!saloonOwner.stripeAccountId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Saloon owner is not connected to Stripe',
    );
  }

  // Get barber
  const barber = await prisma.barber.findUnique({
    where: { userId: barberId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          stripeAccountId: true,
        },
      },
    },
  });

  if (!barber || !barber.user) {
    throw new AppError(httpStatus.NOT_FOUND, 'Barber not found');
  }

  // Verify barber has valid Stripe account
  if (!barber.user.stripeAccountId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Barber is not connected to Stripe',
    );
  }

  // Verify saloon owner's Stripe account exists
  try {
    await stripe.accounts.retrieve(saloonOwner.stripeAccountId);
  } catch (error: any) {
    if (error.code === 'resource_missing') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Saloon owner Stripe account is invalid or no longer exists',
      );
    }
    throw error;
  }

  // Verify barber's Stripe account exists
  try {
    await stripe.accounts.retrieve(barber.user.stripeAccountId);
  } catch (error: any) {
    if (error.code === 'resource_missing') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Barber Stripe account is invalid or no longer exists',
      );
    }
    throw error;
  }

  // Create transfer from saloon owner to barber
  try {
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to pence
      currency: 'gbp',
      destination: barber.user.stripeAccountId,
      description: `Payout from ${saloonOwner.fullName} to ${barber.user.fullName}`,
      metadata: {
        saloonOwnerId: saloonOwner.id,
        barberId: barber.user.id,
        type: 'barber_payout',
      },
    });

    console.log('Transfer created successfully:', {
      transferId: transfer.id,
      from: saloonOwner.fullName,
      to: barber.user.fullName,
      amount: amount,
    });

    return {
      transferId: transfer.id,
      from: {
        id: saloonOwner.id,
        name: saloonOwner.fullName,
      },
      to: {
        id: barber.user.id,
        name: barber.user.fullName,
      },
      amount: amount,
      currency: 'gbp',
      createdAt: new Date(transfer.created * 1000),
    };
  } catch (error: any) {
    console.error('Stripe transfer failed:', error.message);
    throw new AppError(
      httpStatus.CONFLICT,
      `Transfer failed: ${error.message}`,
    );
  }
};

const withdrawFundsFromStripeService = async (userId: string) => {
  
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
  cleanupAbandonedPendingAccounts,
  cancelPaymentRequestToStripe,
  cancelQueuePaymentRequestToStripe
};


