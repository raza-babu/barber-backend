"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeServices = void 0;
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../../../config"));
const isValidAmount_1 = require("../../utils/isValidAmount");
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const client_1 = require("@prisma/client");
const stripe_1 = __importDefault(require("stripe"));
// import { notificationService } from '../Notification/Notification.service';
// Initialize Stripe with your secret API key
const stripe = new stripe_1.default(config_1.default.stripe.stripe_secret_key, {
    apiVersion: '2025-08-27.basil',
});
// Step 1: Create a Customer and Save the Card
const saveCardWithCustomerInfoIntoStripe = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { paymentMethodId } = payload;
        const userId = user.id;
        const findUserStripeId = yield prisma_1.default.user.findUnique({
            where: {
                id: userId,
                role: client_1.UserRoleEnum.CUSTOMER,
                stripeCustomerId: { not: null },
            },
            select: {
                stripeCustomerId: true,
                fullName: true,
                email: true,
                address: true,
            },
        });
        if (!(findUserStripeId === null || findUserStripeId === void 0 ? void 0 : findUserStripeId.stripeCustomerId)) {
            // Create a new Stripe customer
            const customer = yield stripe.customers.create({
                name: user.name,
                email: user.email,
            });
            // Attach PaymentMethod to the Customer
            const attach = yield stripe.paymentMethods.attach(paymentMethodId, {
                customer: customer.id,
            });
            // Set PaymentMethod as Default
            const updateCustomer = yield stripe.customers.update(customer.id, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                },
            });
            // update profile with customerId
            yield prisma_1.default.user.update({
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
        }
        else {
            // Attach PaymentMethod to the existing Customer
            const attach = yield stripe.paymentMethods.attach(paymentMethodId, {
                customer: findUserStripeId.stripeCustomerId,
            });
            // Set PaymentMethod as Default
            const updateCustomer = yield stripe.customers.update(findUserStripeId.stripeCustomerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                },
            });
            return {
                customerId: findUserStripeId.stripeCustomerId,
                paymentMethodId: paymentMethodId,
            };
        }
    }
    catch (error) {
        throw Error(error.message);
    }
});
// Step 2: Authorize the Payment Using Saved Card
const authorizeAndSplitPayment = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { paymentMethodId, bookingId } = payload;
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const findBooking = yield tx.booking.findUnique({
            where: { id: bookingId, status: client_1.BookingStatus.PENDING, userId: userId },
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
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking not found');
        }
        let customerId;
        if (!((_a = findBooking.user) === null || _a === void 0 ? void 0 : _a.stripeCustomerId)) {
            if (customerId) {
                yield stripe.paymentMethods.attach(paymentMethodId, {
                    customer: customerId,
                });
                console.log('customerId', customerId);
                console.log('paymentMethodId', paymentMethodId);
                yield stripe.customers.update(customerId, {
                    invoice_settings: {
                        default_payment_method: paymentMethodId,
                    },
                });
            }
            if (!customerId) {
                const stripeCustomer = yield stripe.customers.create({
                    email: ((_b = findBooking.user) === null || _b === void 0 ? void 0 : _b.email)
                        ? (_c = findBooking.user) === null || _c === void 0 ? void 0 : _c.email
                        : (() => {
                            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Email not found');
                        })(),
                });
                yield stripe.paymentMethods.attach(paymentMethodId, {
                    customer: stripeCustomer.id,
                });
                yield stripe.customers.update(stripeCustomer.id, {
                    invoice_settings: {
                        default_payment_method: paymentMethodId,
                    },
                });
                yield tx.user.update({
                    where: { id: userId },
                    data: { stripeCustomerId: stripeCustomer.id },
                });
                customerId = stripeCustomer.id;
            }
        }
        else {
            customerId = (_d = findBooking.user) === null || _d === void 0 ? void 0 : _d.stripeCustomerId;
        }
        let transferAmount = findBooking.totalPrice * 100; // Amount in cents
        const paymentIntent = yield stripe.paymentIntents.create({
            amount: transferAmount,
            currency: 'usd',
            customer: customerId,
            payment_method: paymentMethodId,
            confirm: true,
            metadata: {
                bookingId: findBooking.id,
                customerId: customerId,
                saloonOwnerId: (_e = findBooking.saloonOwner.user) === null || _e === void 0 ? void 0 : _e.id,
            },
            capture_method: 'manual',
            transfer_data: {
                destination: (_f = findBooking.saloonOwner.user) === null || _f === void 0 ? void 0 : _f.stripeAccountId,
                amount: transferAmount,
            },
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never',
            },
        });
        if (paymentIntent.status === 'requires_capture') {
            const payment = yield tx.payment.create({
                data: {
                    userId: (_g = findBooking.saloonOwner.user) === null || _g === void 0 ? void 0 : _g.id,
                    bookingId: findBooking.id,
                    paymentIntentId: paymentIntent.id,
                    paymentAmount: transferAmount / 100,
                    status: client_1.PaymentStatus.REQUIRES_CAPTURE,
                    paymentMethodId: paymentMethodId,
                    amountProvider: customerId,
                    amountReceiver: (_h = findBooking.saloonOwner.user) === null || _h === void 0 ? void 0 : _h.stripeAccountId,
                },
            });
            if (!payment) {
                throw new AppError_1.default(http_status_1.default.CONFLICT, 'Failed to save payment information');
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
    }));
});
// Step 3: Capture the Payment
const capturePaymentRequestToStripe = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { bookingId, status } = payload;
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const findBooking = yield tx.booking.findUnique({
            where: {
                id: bookingId,
                saloonOwnerId: userId,
                status: client_1.BookingStatus.CONFIRMED,
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
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking not found');
        }
        if (status === client_1.BookingStatus.COMPLETED) {
            yield tx.barberRealTimeStatus.deleteMany({
                where: {
                    barberId: findBooking.barberId,
                    startDateTime: findBooking.startDateTime,
                    endDateTime: findBooking.endDateTime,
                },
            });
            // update queueSlot status to completed
            yield tx.queueSlot.updateMany({
                where: {
                    bookingId: bookingId,
                },
                data: {
                    status: client_1.QueueStatus.COMPLETED,
                },
            });
            yield tx.queue.updateMany({
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
            const findPayment = yield tx.payment.findFirst({
                where: {
                    bookingId: findBooking.id,
                    status: client_1.PaymentStatus.REQUIRES_CAPTURE,
                },
            });
            if (!findPayment) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Payment record not found or already captured');
            }
            if (!findPayment.paymentIntentId) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Payment Intent ID not found');
            }
            const paymentIntent = yield stripe.paymentIntents.capture(findPayment.paymentIntentId);
            if (paymentIntent.status === 'succeeded') {
                const updatePayment = yield tx.payment.update({
                    where: { id: findPayment.id },
                    data: { status: client_1.PaymentStatus.COMPLETED },
                });
                if (!updatePayment) {
                    throw new AppError_1.default(http_status_1.default.CONFLICT, 'Failed to update payment information');
                }
                const updateBooking = yield tx.booking.update({
                    where: { id: findBooking.id },
                    data: { status: client_1.BookingStatus.COMPLETED },
                });
                if (!updateBooking) {
                    throw new AppError_1.default(http_status_1.default.CONFLICT, 'Failed to update booking status');
                }
            }
            return paymentIntent;
        }
        if (status === client_1.BookingStatus.CANCELLED) {
            const findPayment = yield tx.payment.findFirst({
                where: {
                    bookingId: findBooking.id,
                    status: client_1.PaymentStatus.REQUIRES_CAPTURE,
                },
            });
            if (!findPayment) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Payment record not found or already captured');
            }
            if (!findPayment.paymentIntentId) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Payment Intent ID not found');
            }
            const paymentIntent = yield stripe.paymentIntents.cancel(findPayment.paymentIntentId);
            if (paymentIntent.status === 'canceled') {
                // Update payment status to REFUNDED
                yield tx.barberRealTimeStatus.deleteMany({
                    where: {
                        barberId: findBooking.barberId,
                        startDateTime: findBooking.startDateTime,
                        endDateTime: findBooking.endDateTime,
                    },
                });
                // update queueSlot status to cancelled
                yield tx.queueSlot.updateMany({
                    where: {
                        bookingId: bookingId,
                    },
                    data: {
                        status: client_1.QueueStatus.CANCELLED,
                    },
                });
                yield tx.queue.updateMany({
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
                const updatePayment = yield tx.payment.updateMany({
                    where: {
                        bookingId: findBooking.id,
                        status: client_1.PaymentStatus.REQUIRES_CAPTURE,
                    },
                    data: { status: client_1.PaymentStatus.REFUNDED },
                });
                if (updatePayment.count === 0) {
                    throw new AppError_1.default(http_status_1.default.CONFLICT, 'Failed to update payment information');
                }
                const updateBooking = yield tx.booking.update({
                    where: { id: findBooking.id },
                    data: { status: client_1.BookingStatus.CANCELLED },
                });
                if (!updateBooking) {
                    throw new AppError_1.default(http_status_1.default.CONFLICT, 'Failed to update booking status');
                }
                return updateBooking;
            }
        }
    }));
});
// New Route: Save a New Card for Existing Customer
const saveNewCardWithExistingCustomerIntoStripe = (payload) => __awaiter(void 0, void 0, void 0, function* () {
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
});
const getCustomerSavedCardsFromStripe = (userId) => __awaiter(void 0, void 0, void 0, function* () {
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
});
// Delete a card from a customer in the stripe
const deleteCardFromCustomer = (paymentMethodId) => __awaiter(void 0, void 0, void 0, function* () {
    // try {
    //   await stripe.paymentMethods.detach(paymentMethodId);
    //   return { message: 'Card deleted successfully' };
    // } catch (error: any) {
    //   throw new AppError(httpStatus.CONFLICT, error.message);
    // }
});
// Refund amount to customer in the stripe
const refundPaymentToCustomer = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    // try {
    //   // Refund the payment intent
    //   const refund = await stripe.refunds.create({
    //     payment_intent: payload?.paymentIntentId,
    //   });
    //   return refund;
    // } catch (error: any) {
    //   throw new AppError(httpStatus.CONFLICT, error.message);
    // }
});
// Service function for creating a PaymentIntent
const createPaymentIntentService = (payload) => __awaiter(void 0, void 0, void 0, function* () {
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
    //   currency: 'usd',
    //   automatic_payment_methods: {
    //     enabled: true, // Enable automatic payment methods like cards, Apple Pay, Google Pay
    //   },
    // });
    // return {
    //   clientSecret: paymentIntent.client_secret,
    //   dpmCheckerLink: `https://dashboard.stripe.com/settings/payment_methods/review?transaction_id=${paymentIntent.id}`,
    // };
});
const getCustomerDetailsFromStripe = (userId) => __awaiter(void 0, void 0, void 0, function* () {
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
});
const getAllCustomersFromStripe = () => __awaiter(void 0, void 0, void 0, function* () {
    // try {
    //   // Retrieve all customers from Stripe
    //   const customers = await stripe.customers.list({
    //     limit: 2,
    //   });
    //   return customers;
    // } catch (error: any) {
    //   throw new AppError(httpStatus.CONFLICT, error.message);
    // }
});
const createAccountIntoStripe = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield prisma_1.default.user.findUnique({
        where: { id: userId },
    });
    if (!userData) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    if (userData.stripeAccountUrl && userData.stripeCustomerId) {
        const stripeAccountId = userData.stripeCustomerId;
        const accountLink = yield stripe.accountLinks.create({
            account: stripeAccountId,
            refresh_url: `${config_1.default.backend_base_url}/reauthenticate.html`,
            return_url: `${config_1.default.backend_base_url}/onboarding-success.html`,
            type: 'account_onboarding',
        });
        yield prisma_1.default.user.update({
            where: { id: userData.id },
            data: {
                stripeAccountUrl: accountLink.url,
            },
        });
        return accountLink;
    }
    // Create a Stripe Connect account
    const stripeAccount = yield stripe.accounts.create({
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
    const accountLink = yield stripe.accountLinks.create({
        account: stripeAccount.id,
        refresh_url: `${config_1.default.backend_base_url}/reauthenticate.html`,
        return_url: `${config_1.default.backend_base_url}/onboarding-success.html`,
        type: 'account_onboarding',
    });
    const stripeAccountId = stripeAccount.id;
    // Save both Stripe customerId and accountId in the database
    const updateUser = yield prisma_1.default.user.update({
        where: { id: userData.id },
        data: {
            stripeAccountUrl: accountLink.url,
            stripeAccountId: stripeAccountId,
        },
    });
    if (!updateUser) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, 'Failed to save account details');
    }
    return accountLink;
});
const createNewAccountIntoStripe = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    // Fetch user data from the database
    const userData = yield prisma_1.default.user.findUnique({
        where: { id: userId },
    });
    if (!userData) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    let stripeAccountId = userData.stripeAccountId;
    // If the user already has a Stripe account, delete it
    if (stripeAccountId) {
        yield stripe.accounts.del(stripeAccountId); // Delete the old account
    }
    // Create a new Stripe account
    const newAccount = yield stripe.accounts.create({
        type: 'express',
        email: userData.email, // Use the user's email from the database
        country: 'US', // Set the country dynamically if needed
        capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
        },
        metadata: {
            userId: userData.id, // Add metadata for reference
        },
    });
    // Generate the onboarding link for the new Stripe account
    const accountLink = yield stripe.accountLinks.create({
        account: newAccount.id,
        refresh_url: `${config_1.default.backend_base_url}/reauthenticate.html`,
        return_url: `${config_1.default.backend_base_url}/onboarding-success.html`,
        type: 'account_onboarding',
    });
    // Update the user's Stripe account ID and URL in the database
    yield prisma_1.default.user.update({
        where: { id: userData.id },
        data: {
            stripeAccountId: newAccount.id,
            stripeAccountUrl: accountLink.url,
        },
    });
    return accountLink;
});
const tipPaymentToBarberService = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { bookingId, barberAmount, saloonOwnerAmount, paymentMethodId } = payload;
    if (!(0, isValidAmount_1.isValidAmount)(barberAmount) || !(0, isValidAmount_1.isValidAmount)(saloonOwnerAmount)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid amount. Amount must be positive with up to 2 decimals.');
    }
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _j, _k, _l;
        const booking = yield tx.booking.findUnique({
            where: { id: bookingId, status: client_1.BookingStatus.COMPLETED, userId },
            include: {
                saloonOwner: { include: { user: true } },
                barber: { include: { user: true } },
                user: { select: { id: true, stripeCustomerId: true } },
            },
        });
        if (!booking)
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking not found');
        if (!((_j = booking.user) === null || _j === void 0 ? void 0 : _j.stripeCustomerId))
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Customer has no Stripe ID');
        if (!((_k = booking.saloonOwner.user) === null || _k === void 0 ? void 0 : _k.stripeAccountId))
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon owner missing Stripe account ID');
        if (!((_l = booking.barber.user) === null || _l === void 0 ? void 0 : _l.stripeAccountId))
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber missing Stripe account ID');
        const totalAmount = barberAmount + saloonOwnerAmount;
        const serviceCharge = totalAmount * 0.001; // 0.1% service fee
        const finalAmount = totalAmount + serviceCharge;
        const paymentIntent = yield stripe.paymentIntents.create({
            amount: Math.round(finalAmount * 100), // in cents
            currency: 'usd',
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
            yield stripe.transfers.create({
                amount: Math.round(saloonOwnerAmount * 100),
                currency: 'usd',
                destination: booking.saloonOwner.user.stripeAccountId,
                metadata: { bookingId: booking.id, role: 'saloon_owner' },
            });
            // Transfer to barber
            yield stripe.transfers.create({
                amount: Math.round(barberAmount * 100),
                currency: 'usd',
                destination: booking.barber.user.stripeAccountId,
                metadata: { bookingId: booking.id, role: 'barber' },
            });
            // DB payments
            yield tx.payment.createMany({
                data: [
                    {
                        userId: booking.saloonOwner.user.id,
                        bookingId: booking.id,
                        paymentIntentId: paymentIntent.id,
                        paymentAmount: saloonOwnerAmount,
                        status: client_1.PaymentStatus.COMPLETED,
                        paymentMethodId,
                        amountProvider: booking.user.stripeCustomerId,
                        amountReceiver: booking.saloonOwner.user.stripeAccountId,
                    },
                    {
                        userId: booking.barber.user.id,
                        bookingId: booking.id,
                        paymentIntentId: paymentIntent.id,
                        paymentAmount: barberAmount,
                        status: client_1.PaymentStatus.COMPLETED,
                        paymentMethodId,
                        amountProvider: booking.user.stripeCustomerId,
                        amountReceiver: booking.barber.user.stripeAccountId,
                    },
                ],
            });
        }
        return paymentIntent;
    }));
});
exports.StripeServices = {
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
};
