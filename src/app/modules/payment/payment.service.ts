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
  PayoutRequestStatus,
} from '@prisma/client';
import Stripe from 'stripe';
import { TStripeSaveWithCustomerInfoPayload } from './payment.interface';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
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
    status: BookingStatus;
  },
  tx?: any,
) => {
  const { bookingId, status } = payload;

  
  // Use provided transaction or create a new one
  if (tx) {
    const findBooking = await tx.booking.findUnique({
      where: {
        id: bookingId,
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
    
    // Verify the user is authorized (either saloon owner or customer)
    if (findBooking.saloonOwnerId !== userId && findBooking.userId !== userId) {
      throw new AppError(httpStatus.FORBIDDEN, 'Not authorized to capture this booking payment');
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
    return null;
  }

  // Default behavior: create new transaction
  return await prisma.$transaction(async tx => {
    const findBooking = await tx.booking.findUnique({
      where: {
        id: bookingId,
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
    
    // Verify the user is authorized (either saloon owner or customer)
    if (findBooking.saloonOwnerId !== userId && findBooking.userId !== userId) {
      throw new AppError(httpStatus.FORBIDDEN, 'Not authorized to capture this booking payment');
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

    if (!findPayment.checkoutSessionId && !findPayment.paymentIntentId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Checkout Session ID or Payment Intent ID missing',
      );
    }

    /* ---------------------------------------------------- */
    /* 4 Handle Cancellation Based on Session/Intent Type */
    /* ---------------------------------------------------- */

    if (isWithinFiveMinutes) {
      // WITHIN 5 MINS: Refund (totalAmount - £0.50)
      
      try {
        // If this is a Checkout Session, expire the session
        if (findPayment.checkoutSessionId) {
          const session = await stripe.checkout.sessions.expire(
            findPayment.checkoutSessionId,
          );

          console.log('Checkout Session Expired:', {
            sessionId: findPayment.checkoutSessionId,
            status: session.payment_status,
            timestamp: new Date(),
          });

          // Session is expired, payment will be canceled automatically
        } 
        // If this is a regular PaymentIntent (not from Checkout)
        else if (findPayment.paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            findPayment.paymentIntentId,
          );

          if (paymentIntent.status === 'requires_capture') {
            // FIRST: Capture the full amount to settle the payment
            await stripe.paymentIntents.capture(findPayment.paymentIntentId);
            
            // THEN: Immediately refund amount minus service fee (£0.50)
            const refundAmount = Math.max(0, paymentIntent.amount - SERVICE_FEE_PENCE);
            if (refundAmount > 0) {
              await stripe.refunds.create({
                payment_intent: findPayment.paymentIntentId,
                amount: refundAmount,
              });
            }
          } else if (paymentIntent.status === 'succeeded') {
            // Create refund for amount minus service fee
            const refundAmount = Math.max(0, paymentIntent.amount - SERVICE_FEE_PENCE);
            if (refundAmount > 0) {
              await stripe.refunds.create({
                payment_intent: findPayment.paymentIntentId,
                amount: refundAmount,
              });
            }
          }
        }
      } catch (error: any) {
        console.error('Error canceling/expiring payment:', error.message);
        // Continue with DB update even if Stripe action fails
      }

      await tx.payment.update({
        where: { id: findPayment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          paymentAmount: SERVICE_FEE_PENCE,
        },
      });
    } else {
      // AFTER 5 MINS: No refund, admin keeps £0.50
      
      try {
        // If this is a Checkout Session, we cannot do anything since it's already completed
        if (findPayment.checkoutSessionId) {
          const session = await stripe.checkout.sessions.retrieve(
            findPayment.checkoutSessionId,
          );

          // If payment is already completed, we cannot cancel it
          if (session.payment_status === 'paid') {
            console.log('Checkout Session already paid, cannot cancel:', {
              sessionId: findPayment.checkoutSessionId,
              paymentStatus: session.payment_status,
            });
          } else {
            // Try to expire if not yet paid
            await stripe.checkout.sessions.expire(findPayment.checkoutSessionId);
          }
        }
        // If it's a regular PaymentIntent
        else if (findPayment.paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            findPayment.paymentIntentId,
          );

          if (paymentIntent.status === 'requires_capture') {
            // Capture full amount - this triggers the transfer_data to shop owner
            await stripe.paymentIntents.capture(findPayment.paymentIntentId);
          }
          // If already succeeded, do nothing - payment already captured
        }
      } catch (error: any) {
        console.error('Error processing payment after 5 mins:', error.message);
        // Continue with DB update
      }

      await tx.payment.update({
        where: { id: findPayment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          paymentAmount: findPayment.paymentAmount || 0,
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
    country: 'US',
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

  return await prisma.$transaction(async tx => {
    // Get saloon owner (user making the payout)
    const saloonOwner = await tx.user.findUnique({
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
    if (!saloonOwner.SaloonOwner) {
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
    const barber = await tx.barber.findUnique({
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

    // Verify saloon owner has transfer capability
    try {
      const saloonOwnerAccount = await stripe.accounts.retrieve(
        saloonOwner.stripeAccountId,
      );

      if (saloonOwnerAccount.capabilities?.transfers !== 'active') {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Saloon owner transfer capability is not active. Please complete Stripe onboarding.',
        );
      }
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        httpStatus.CONFLICT,
        `Account verification failed: ${error.message}`,
      );
    }

    // CHECK BALANCE on Shop Owner's account
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: saloonOwner.stripeAccountId,
      });

      const requestedAmountPence = Math.round(amount * 100);
      const availableBalance = balance.available[0]?.amount || 0;

      if (availableBalance < requestedAmountPence) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Insufficient balance. Available: £${(availableBalance / 100).toFixed(2)}, Requested: £${amount.toFixed(2)}`,
        );
      }
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        httpStatus.CONFLICT,
        `Balance check failed: ${error.message}`,
      );
    }

    // Step 1: Create payout request in database (PENDING)
    const amountInPence = Math.round(amount * 100);
    const payoutRequest = await tx.barberPayoutRequest.create({
      data: {
        saloonOwnerId: saloonOwner.id,
        barberId: barber.user.id,
        amount: amount,
        status: 'PENDING',
      },
    });

    // Step 2: Use two-step transfer (Shop Owner → Platform → Barber)
    // Note: Direct connected-to-connected transfers are not allowed by Stripe
    // So we use Platform Account as intermediary
    
    // Verify platform account ID is configured
    const platformAccountId = config.stripe.stripe_platform_account_id;
    if (!platformAccountId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Platform account ID is not configured. Please set STRIPE_PLATFORM_ACCOUNT_ID environment variable.',
      );
    }

    let transfer1, transfer2;
    
    try {
      // Transfer 1: Shop Owner's Account → Platform Account
      // NOTE: Using USD for testing - change to 'gbp' for production
      transfer1 = await stripe.transfers.create(
        {
          amount: amountInPence,
          currency: 'usd',
          destination: platformAccountId, // Transfer to main platform account
          description: `Transfer from ${saloonOwner.fullName} to be paid to barber`,
          metadata: {
            payoutRequestId: payoutRequest.id,
            saloonOwnerId: saloonOwner.id,
            barberId: barber.user.id,
            type: 'shop_to_platform',
          },
        },
        {
          stripeAccount: saloonOwner.stripeAccountId,
        },
      );

      console.log('Step 1 Complete - Transfer from Shop Owner to Platform:', {
        transferId: transfer1.id,
        amount: amount,
        from: saloonOwner.fullName,
        to: 'Platform Account',
      });
    } catch (error: any) {
      console.error('Transfer from shop owner to platform failed:', error.message);
      
      // Handle country mismatch errors
      if (error.message.includes('Account debits are not supported from')) {
        throw new AppError(
          httpStatus.CONFLICT,
          `Country mismatch error: Your platform account and shop owner account are in different countries. Ensure your platform account (${platformAccountId}) is in the same country as the shop owner's account.`,
        );
      }
      
      throw new AppError(
        httpStatus.CONFLICT,
        `Transfer from shop owner failed: ${error.message}`,
      );
    }

    try {
      // Transfer 2: Platform Account → Barber's Account
      // NOTE: Using USD for testing - change to 'gbp' for production
      transfer2 = await stripe.transfers.create({
        amount: amountInPence,
        currency: 'usd',
        destination: barber.user.stripeAccountId!,
        description: `Payout from ${saloonOwner.fullName} to ${barber.user.fullName}`,
        metadata: {
          payoutRequestId: payoutRequest.id,
          saloonOwnerId: saloonOwner.id,
          barberId: barber.user.id,
          type: 'platform_to_barber',
        },
      });

      console.log('Step 2 Complete - Transfer from Platform to Barber:', {
        transferId: transfer2.id,
        amount: amount,
        from: 'Platform Account',
        to: barber.user.fullName,
      });
    } catch (error: any) {
      console.error('Transfer from platform to barber failed:', error.message);
      throw new AppError(
        httpStatus.CONFLICT,
        `Transfer to barber failed: ${error.message}`,
      );
    }

    // Step 3: Update payout request status to COMPLETED
    const completedPayout = await tx.barberPayoutRequest.update({
      where: { id: payoutRequest.id },
      data: {
        status: PayoutRequestStatus.SETTLED,
      },
      include: {
        saloonOwner: {
          select: {
            id: true,
            shopName: true,
            user: {
              select: {
                id: true,
                fullName: true,
                stripeAccountId: true,
              },
            },
          },
        },
        barber: {
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                fullName: true,
                stripeAccountId: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      payoutType: 'two_step_automatic_transfer',
      payoutRequestId: completedPayout.id,
      message: 'Payout completed successfully! Funds transferred through platform. [TEST MODE - USD CURRENCY]',
      transfers: {
        step1: {
          transferId: transfer1.id,
          direction: `${saloonOwner.fullName} → Platform`,
          amount: amount,
          currency: 'usd', // Testing with USD
        },
        step2: {
          transferId: transfer2.id,
          direction: `Platform → ${barber.user.fullName}`,
          amount: amount,
          currency: 'usd', // Testing with USD
        },
      },
      from: {
        id: saloonOwner.id,
        name: saloonOwner.fullName,
        stripeAccount: saloonOwner.stripeAccountId,
      },
      to: {
        id: barber.user.id,
        name: barber.user.fullName,
        stripeAccount: barber.user.stripeAccountId,
      },
      amount: amount,
      amountInPence: amountInPence,
      status: completedPayout.status,
      createdAt: completedPayout.createdAt,
      completedAt: new Date(),
    };
  });
};

// Barber-specific withdraw funds service
const withdrawFundsAsBarberService = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      Barber: {
        select: { userId: true },
      },
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Verify user is a barber
  if (!user.Barber) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'User is not a barber',
    );
  }

  // Authorization check: User can only withdraw their own funds
  if (user.Barber.userId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Not authorized to withdraw funds for this barber account',
    );
  }

  return await performWithdrawalProcess(user, 'barber');
};

// Saloon Owner-specific withdraw funds service
const withdrawFundsAsSaloonOwnerService = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      SaloonOwner: {
        select: { userId: true, shopName: true },
      },
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Verify user is a saloon owner
  if (!user.SaloonOwner) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'User is not a saloon owner',
    );
  }

  // Authorization check: User can only withdraw their own funds
  if (user.SaloonOwner[0].userId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Not authorized to withdraw funds for this saloon owner account',
    );
  }

  return await performWithdrawalProcess(user, 'saloon_owner');
};

// Core withdrawal process (shared logic)
const performWithdrawalProcess = async (user: any, userType: 'barber' | 'saloon_owner') => {
  // Verify user has valid Stripe account
  if (!user.stripeAccountId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'User is not connected to Stripe. Please complete Stripe onboarding first.',
    );
  }

  // Declare variables outside try block so they're accessible in catch block
  let availableBalance = 0;
  let payoutAmount = 0;

  try {
    // Verify the Stripe account exists and is active
    const stripeAccount = await stripe.accounts.retrieve(user.stripeAccountId);

    if (!stripeAccount) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Stripe account is invalid or no longer exists',
      );
    }

    // Get the current balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: user.stripeAccountId,
    });

    availableBalance = balance.available[0]?.amount || 0; // in pence
    const availableBalanceGBP = availableBalance / 100;
    const pendingBalance = balance.pending[0]?.amount || 0; // in pence
    const pendingBalanceGBP = pendingBalance / 100;

    // Minimum payout amount required by Stripe (in pence)
    const MINIMUM_PAYOUT_PENCE = 100; // £1.00 minimum
    const RESERVE_BUFFER_PENCE = 50; // £0.50 buffer for potential fees

    // Check if there are sufficient funds available to withdraw
    if (availableBalance < MINIMUM_PAYOUT_PENCE) {
      return {
        success: false,
        message: `Insufficient balance to withdraw. Minimum required is £${(MINIMUM_PAYOUT_PENCE / 100).toFixed(2)}.`,
        balanceInfo: {
          available: availableBalanceGBP.toFixed(2),
          pending: pendingBalanceGBP.toFixed(2),
          minRequired: (MINIMUM_PAYOUT_PENCE / 100).toFixed(2),
          currency: 'gbp',
        },
        nextSteps: [
          'Wait for more transactions to accumulate funds',
          'Check your Stripe dashboard for real-time balance updates',
          'Try again once your available balance reaches the minimum amount',
        ],
      };
    }

    // Check if bank account is connected
    const externalAccounts = stripeAccount.external_accounts;
    
    if (!externalAccounts || externalAccounts.data.length === 0) {
      return {
        success: false,
        message: 'No bank account connected to your Stripe account. Please add a bank account first via Stripe dashboard.',
        loginUrl: null,
        needsBankAccount: true,
        balanceInfo: {
          available: availableBalanceGBP.toFixed(2),
          pending: pendingBalanceGBP.toFixed(2),
          currency: 'gbp',
        },
        instructions: 'Please connect a bank account to your Stripe account to enable automatic payouts.',
      };
    }

    // Calculate payout amount with buffer for potential fees
    payoutAmount = Math.max(
      MINIMUM_PAYOUT_PENCE,
      availableBalance - RESERVE_BUFFER_PENCE
    );

    console.log('Attempting payout:', {
      userId: user.id,
      userType,
      availableBalance,
      payoutAmount,
      reserve: RESERVE_BUFFER_PENCE,
      stripe_account_id: user.stripeAccountId,
    });

    // Create automatic payout to connected bank account
    const payout = await stripe.payouts.create(
      {
        amount: payoutAmount, // Transfer available balance minus buffer
        currency: 'gbp',
        method: 'standard', // Standard ACH/wire transfer
        description: `Automatic payout for ${userType === 'saloon_owner' ? 'shop owner' : 'barber'} ${user.fullName}`,
      },
      {
        stripeAccount: user.stripeAccountId,
      },
    );

    // Log payout creation
    console.log('Automatic Payout Created:', {
      userId: user.id,
      userName: user.fullName,
      userType: userType,
      payoutId: payout.id,
      amount: availableBalanceGBP,
      bankAccount: externalAccounts.data[0]?.last4,
      status: payout.status,
      arrivalDate: payout.arrival_date,
      timestamp: new Date(),
    });

    // Calculate arrival date
    const arrivalDate = payout.arrival_date 
      ? new Date(payout.arrival_date * 1000) 
      : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // Default 2 business days

    return {
      success: true,
      payoutType: 'automatic_bank_transfer',
      message: 'Funds are being transferred to your bank account automatically!',
      payoutDetails: {
        payoutId: payout.id,
        amount: availableBalanceGBP.toFixed(2),
        currency: 'gbp',
        status: payout.status, // 'pending', 'in_transit', 'paid', 'failed', 'cancelled'
        bankAccount: externalAccounts.data[0]?.last4 || 'Connected account',
        arrivalDate: arrivalDate.toISOString().split('T')[0],
        estimatedDays: '1-2 business days',
      },
      accountDetails: {
        name: user.fullName,
        email: user.email,
        stripeAccountId: user.stripeAccountId,
        userType: userType,
        ...(userType === 'saloon_owner' && user.SaloonOwner?.shopName && { shopName: user.SaloonOwner.shopName }),
      },
      balanceInfo: {
        transferred: availableBalanceGBP.toFixed(2),
        pending: pendingBalanceGBP.toFixed(2),
        currency: 'gbp',
      },
      nextSteps: {
        step1: 'Payout is now being processed',
        step2: `Expected arrival: ${arrivalDate.toLocaleDateString()} (1-2 business days)`,
        step3: 'You will receive the funds in your connected bank account',
        step4: 'Check your bank account or Stripe dashboard for confirmation',
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }

    // Handle insufficient funds errors from Stripe
    if (
      error.message?.includes('insufficient funds') ||
      error.message?.includes('card balance is too low') ||
      error.code === 'insufficient_funds'
    ) {
      // Fetch current balance for detailed error message
      try {
        const currentBalance = await stripe.balance.retrieve({
          stripeAccount: user.stripeAccountId,
        });
        const currentAvailable = (currentBalance.available[0]?.amount || 0) / 100;
        const currentPending = (currentBalance.pending[0]?.amount || 0) / 100;
        
        // Check if there's a significant discrepancy (indicates holds/restrictions)
        const hasAccountHolds = currentPending > 0 && currentAvailable < payoutAmount / 100;
        
        if (hasAccountHolds) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            `Your account has pending transactions or holds that prevent immediate payout. Available: £${currentAvailable.toFixed(2)}, Pending: £${currentPending.toFixed(2)}. Please check your Stripe dashboard for pending disputes or restrictions, or try again after pending transactions clear.`,
          );
        }
        
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Insufficient funds for payout. Available balance: £${currentAvailable.toFixed(2)}. Your Stripe account may have restrictions or holds. Please check your Stripe dashboard at https://dashboard.stripe.com/balances or contact Stripe support.`,
        );
      } catch (balanceError: any) {
        if (balanceError instanceof AppError) throw balanceError;
        // If we can't fetch balance, provide generic message
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Stripe rejected the payout request due to insufficient or held funds. Please check your Stripe dashboard for account restrictions, pending disputes, or contact Stripe support for assistance.',
        );
      }
    }

    if (error.code === 'resource_missing') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Stripe account is invalid or no longer exists',
      );
    }
    if (error.code === 'account_invalid') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Your Stripe account does not have the ability to make payouts. Please complete account verification.',
      );
    }
    if (error.message?.includes('External account not found')) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'No bank account connected. Please add a bank account to your Stripe account first.',
      );
    }
    
    // Log detailed error for debugging
    console.error('Failed to create automatic payout:', {
      errorMessage: error.message,
      errorCode: error.code,
      stripeError: error.raw?.message || error.type,
      userId: user.id,
      userType,
      attemptedAmount: payoutAmount / 100,
      availableBalance: availableBalance / 100,
      timestamp: new Date(),
    });

    throw new AppError(
      httpStatus.CONFLICT,
      `Failed to process automatic payout: ${error.message || 'Unknown error'}`,
    );
  }
};

const withdrawFundsFromStripeService = async (userId: string) => {
  // Get user and check if they're a barber or saloon owner
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      SaloonOwner: {
        select: { userId: true, shopName: true },
      },
      Barber: {
        select: { userId: true },
      },
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Verify user is either a barber or saloon owner (not both)
  const isBarber = !!user.Barber;
  const isSaloonOwner = !!user.SaloonOwner;

  // User must be exactly one, not both or neither
  if (isBarber === isSaloonOwner) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'User must be either a barber or a saloon owner, not both',
    );
  }

  // Authorization check: User can only withdraw their own funds
  // If barber, verify they own this barber account
  if (isBarber && user.Barber?.userId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Not authorized to withdraw funds for this barber account',
    );
  }

  // If saloon owner, verify they own this saloon owner account
  if (isSaloonOwner && user.SaloonOwner?.[0]?.userId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Not authorized to withdraw funds for this saloon owner account',
    );
  }

  // Verify user has valid Stripe account
  if (!user.stripeAccountId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'User is not connected to Stripe. Please complete Stripe onboarding first.',
    );
  }

  try {
    // Verify the Stripe account exists and is active
    const stripeAccount = await stripe.accounts.retrieve(user.stripeAccountId);

    if (!stripeAccount) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Stripe account is invalid or no longer exists',
      );
    }

    // Get the current balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: user.stripeAccountId,
    });

    const availableBalance = balance.available[0]?.amount || 0; // in pence
    const availableBalanceGBP = availableBalance / 100;
    const pendingBalance = balance.pending[0]?.amount || 0; // in pence
    const pendingBalanceGBP = pendingBalance / 100;

    // Check if there are funds available to withdraw
    if (availableBalance <= 0) {
      return {
        success: false,
        message: 'No available funds to withdraw',
        balanceInfo: {
          available: availableBalanceGBP.toFixed(2),
          pending: pendingBalanceGBP.toFixed(2),
          currency: 'gbp',
        },
      };
    }

    // Check if bank account is connected
    const externalAccounts = stripeAccount.external_accounts;
    
    if (!externalAccounts || externalAccounts.data.length === 0) {
      return {
        success: false,
        message: 'No bank account connected to your Stripe account. Please add a bank account first via Stripe dashboard.',
        loginUrl: null,
        needsBankAccount: true,
        balanceInfo: {
          available: availableBalanceGBP.toFixed(2),
          pending: pendingBalanceGBP.toFixed(2),
          currency: 'gbp',
        },
        instructions: 'Please connect a bank account to your Stripe account to enable automatic payouts.',
      };
    }

    // Create automatic payout to connected bank account
    const payout = await stripe.payouts.create(
      {
        amount: availableBalance, // Transfer entire available balance
        currency: 'gbp',
        method: 'standard', // Standard ACH/wire transfer
        description: `Automatic payout for ${isSaloonOwner ? 'shop owner' : 'barber'} ${user.fullName}`,
      },
      {
        stripeAccount: user.stripeAccountId,
      },
    );

    // Log payout creation
    console.log('Automatic Payout Created:', {
      userId: user.id,
      userName: user.fullName,
      userType: isBarber ? 'barber' : 'saloon_owner',
      payoutId: payout.id,
      amount: availableBalanceGBP,
      bankAccount: externalAccounts.data[0]?.last4,
      status: payout.status,
      arrivalDate: payout.arrival_date,
      timestamp: new Date(),
    });

    // Calculate arrival date
    const arrivalDate = payout.arrival_date 
      ? new Date(payout.arrival_date * 1000) 
      : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // Default 2 business days

    return {
      success: true,
      payoutType: 'automatic_bank_transfer',
      message: 'Funds are being transferred to your bank account automatically!',
      payoutDetails: {
        payoutId: payout.id,
        amount: availableBalanceGBP.toFixed(2),
        currency: 'gbp',
        status: payout.status, // 'pending', 'in_transit', 'paid', 'failed', 'cancelled'
        bankAccount: externalAccounts.data[0]?.last4 || 'Connected account',
        arrivalDate: arrivalDate.toISOString().split('T')[0],
        estimatedDays: '1-2 business days',
      },
      accountDetails: {
        name: user.fullName,
        email: user.email,
        stripeAccountId: user.stripeAccountId,
        userType: isBarber ? 'barber' : 'saloon_owner',
        ...(isSaloonOwner && user.SaloonOwner?.[0]?.shopName && { shopName: user.SaloonOwner[0].shopName }),
      },
      balanceInfo: {
        transferred: availableBalanceGBP.toFixed(2),
        pending: pendingBalanceGBP.toFixed(2),
        currency: 'gbp',
      },
      nextSteps: {
        step1: 'Payout is now being processed',
        step2: `Expected arrival: ${arrivalDate.toLocaleDateString()} (1-2 business days)`,
        step3: 'You will receive the funds in your connected bank account',
        step4: 'Check your bank account or Stripe dashboard for confirmation',
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error.code === 'resource_missing') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Stripe account is invalid or no longer exists',
      );
    }
    if (error.code === 'account_invalid') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Your Stripe account does not have the ability to make payouts. Please complete account verification.',
      );
    }
    if (error.message.includes('External account not found')) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'No bank account connected. Please add a bank account to your Stripe account first.',
      );
    }
    
    console.error('Failed to create automatic payout:', error.message);
    throw new AppError(
      httpStatus.CONFLICT,
      `Failed to process automatic payout: ${error.message}`,
    );
  }
}

// Get all pending barber payout requests
const getPendingBarberPayoutsService = async (options?: ISearchAndFilterOptions) => {
  try {
    const where: any = {};
    let skip = 0;
    let take = 10; // Default limit

    // Handle pagination
    if (options?.page && options?.limit) {
      const page = Math.max(1, options.page);
      skip = (page - 1) * options.limit;
      take = options.limit;
    }

    // Handle filtering from options directly
    if (options?.saloonOwnerId) {
      where.saloonOwnerId = options.saloonOwnerId;
    }
    if (options?.barberId) {
      where.barberId = options.barberId;
    }
    if (options?.status) {
      where.status = options.status;
    }

    // Handle additional filters passed through filters object
    if (options?.filters) {
      Object.keys(options.filters).forEach((key) => {
        if (options.filters![key] !== undefined && options.filters![key] !== null) {
          where[key] = options.filters![key];
        }
      });
    }

    // Handle date range filtering
    if (options?.startDate || options?.endDate) {
      const dateField = options?.dateField || 'createdAt';
      where[dateField] = {};
      
      if (options?.startDate) {
        where[dateField].gte = new Date(options.startDate);
      }
      if (options?.endDate) {
        where[dateField].lte = new Date(options.endDate);
      }
    }

    // Determine sort order
    const sortBy = options?.sortBy || 'createdAt';
    const sortOrder = options?.sortOrder || 'desc';
    const orderBy: any = { [sortBy]: sortOrder };

    // Get total count for pagination
    const total = await prisma.barberPayoutRequest.count({ where });

    // Fetch payout requests
    const payoutRequests = await prisma.barberPayoutRequest.findMany({
      where,
      include: {
        saloonOwner: {
          select: {
            id: true,
            userId: true,
            shopName: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                stripeAccountId: true,
              },
            },
          },
        },
        barber: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                stripeAccountId: true,
              },
            },
          },
        },
      },
      orderBy,
      skip,
      take,
    });

    // Calculate pagination metadata
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const totalPages = Math.ceil(total / limit);

    return {
      total,
      data: payoutRequests,
      meta: {
        page,
        limit,
        totalPages,
        total: payoutRequests.length,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error: any) {
    console.error('Failed to fetch payout requests:', error.message);
    throw new AppError(
      httpStatus.CONFLICT,
      `Failed to fetch payout requests: ${error.message}`,
    );
  }
};

// Settle/Approve barber payout request
const settleBarberPayoutService = async (
  userId: string,
  payoutRequestId: string,
) => {
  try {
    // Verify requesting user is admin or authorized personnel
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Find the payout request
    const payoutRequest = await prisma.barberPayoutRequest.findUnique({
      where: { id: payoutRequestId },
      include: {
        saloonOwner: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
        barber: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!payoutRequest) {
      throw new AppError(httpStatus.NOT_FOUND, 'Payout request not found');
    }

    if (payoutRequest.status !== 'PENDING') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Cannot settle payout request with status: ${payoutRequest.status}`,
      );
    }

    // Update payout request status to SETTLED
    const settledPayout = await prisma.barberPayoutRequest.update({
      where: { id: payoutRequestId },
      data: {
        status: PayoutRequestStatus.SETTLED,
        settledAt: new Date(),
      },
      include: {
        saloonOwner: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
        barber: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    console.log('Barber Payout Settled:', {
      payoutRequestId: settledPayout.id,
      saloonOwner: payoutRequest.saloonOwner.user.fullName,
      barber: payoutRequest.barber.user.fullName,
      amount: settledPayout.amount,
      settledAt: settledPayout.settledAt,
      settledBy: user.email,
    });

    return {
      success: true,
      message: 'Payout request settled successfully',
      data: settledPayout,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    console.error('Failed to settle payout:', error.message);
    throw new AppError(
      httpStatus.CONFLICT,
      `Failed to settle payout: ${error.message}`,
    );
  }
};

// Reject barber payout request
const rejectBarberPayoutService = async (
  userId: string,
  payoutRequestId: string,
  notes?: string,
) => {
  try {
    // Verify requesting user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Find the payout request
    const payoutRequest = await prisma.barberPayoutRequest.findUnique({
      where: { id: payoutRequestId },
    });

    if (!payoutRequest) {
      throw new AppError(httpStatus.NOT_FOUND, 'Payout request not found');
    }

    if (payoutRequest.status !== 'PENDING') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Cannot reject payout request with status: ${payoutRequest.status}`,
      );
    }

    // Update payout request status to REJECTED
    const rejectedPayout = await prisma.barberPayoutRequest.update({
      where: { id: payoutRequestId },
      data: {
        status: 'REJECTED',
        notes: notes || 'Rejected by admin',
      },
      include: {
        saloonOwner: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
        barber: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    console.log('Barber Payout Rejected:', {
      payoutRequestId: rejectedPayout.id,
      reason: notes || 'No reason provided',
      rejectedBy: user.email,
    });

    return {
      success: true,
      message: 'Payout request rejected successfully',
      data: rejectedPayout,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    console.error('Failed to reject payout:', error.message);
    throw new AppError(
      httpStatus.CONFLICT,
      `Failed to reject payout: ${error.message}`,
    );
  }
};

const checkAvailableBalanceService
  = async (userId: string) => {
    // Get user and check if they're a barber or saloon owner
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: user.stripeAccountId!,
      });
      const availableBalance = balance.available[0]?.amount || 0; // in pence
      const pendingBalance = balance.pending[0]?.amount || 0; // in pence
      return {  
        availableBalance: availableBalance / 100, // Convert to GBP
        pendingBalance: pendingBalance / 100, // Convert to GBP
        currency: balance.available[0]?.currency.toUpperCase() || 'GBP',
      };
    }
    catch (error: any) {
      console.error('Failed to retrieve balance:', error.message);
      throw new AppError(
        httpStatus.CONFLICT,
        `Failed to retrieve balance: ${error.message}`,
      );
    }
  };



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
  withdrawFundsAsBarberService,
  withdrawFundsAsSaloonOwnerService,
  cleanupAbandonedPendingAccounts,
  cancelPaymentRequestToStripe,
  cancelQueuePaymentRequestToStripe,
  getPendingBarberPayoutsService,
  settleBarberPayoutService,
  rejectBarberPayoutService,
  checkAvailableBalanceService,
};


