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
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const client_1 = require("@prisma/client");
// import { ParcelStatus, PaymentStatus, UserRoleEnum } from '@prisma/client';
// import { notificationService } from '../Notification/Notification.service';
// import {
//   createRecipient,
//   createTransfer,
//   paystackRequest,
// } from '../../utils/paystack';
// Step 1: Create a Customer and Save the Card
const saveCardWithCustomerInfoIntoPaystack = (payload, user) => __awaiter(void 0, void 0, void 0, function* () {
    // try {
    //   const { authorization_code } = payload;
    //   // Check if the user already has a Paystack customer code
    //   let existCustomer = await prisma.user.findUnique({
    //     where: { id: user.id },
    //     select: { paystackCustomerCode: true, fullName: true, email: true },
    //   });
    //   if (!existCustomer) {
    //     throw new AppError(httpStatus.BAD_REQUEST, 'Customer not found');
    //   }
    //   if (!existCustomer.paystackCustomerCode) {
    //     // Create a new Paystack customer
    //     const customer = await paystack.customer.create({
    //       email: existCustomer.email,
    //       first_name: existCustomer.fullName.split(' ')[0],
    //       last_name: existCustomer.fullName.split(' ')[1] || '',
    //       phone: user.phone || '', // Add phone if available
    //     });
    //     // Save the customer code and authorization code in the database
    //     await prisma.user.update({
    //       where: { id: user.id },
    //       data: {
    //         paystackCustomerCode: customer.data.customer_code,
    //         paystackAuthorizationCode: authorization_code, // Save authorization code
    //       },
    //     });
    //     return {
    //       customerCode: customer.data.customer_code,
    //       authorizationCode: authorization_code,
    //     };
    //   } else {
    //     // Update the authorization code in the database for the existing customer
    //     await prisma.user.update({
    //       where: { id: user.id },
    //       data: { paystackAuthorizationCode: authorization_code },
    //     });
    //     return {
    //       customerCode: existCustomer.paystackCustomerCode,
    //       authorizationCode: authorization_code,
    //     };
    //   }
    // } catch (error: any) {
    //   console.error('Error in saveCardWithCustomerInfoIntoPaystack:', error);
    //   throw new Error(error.message);
    // }
});
// Step 2: Authorize the Payment Using Saved Card
const authorizeAndSplitPayment = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { parcelId } = payload;
    // Retrieve user details
    const customerDetails = yield prisma_1.default.user.findUnique({
        where: { id: userId, role: client_1.UserRoleEnum.CUSTOMER },
    });
    if (!customerDetails) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'User not found');
    }
    // Retrieve the parcel details
    // const parcel = await prisma.parcel.findUnique({
    //   where: {
    //     id: parcelId,
    //     userId: userId,
    //     paymentStatus: PaymentStatus.PENDING,
    //   },
    // });
    // if (!parcel) {
    //   throw new AppError(httpStatus.BAD_REQUEST, 'Parcel not found');
    // }
    // if (!parcel.deliveryPersonId) {
    //   throw new AppError(httpStatus.BAD_REQUEST, 'Delivery person ID not found');
    // }
    // Retrieve delivery person details
    // const deliveryPerson = await prisma.user.findUnique({
    //   where: { id: parcel.deliveryPersonId },
    //   select: {
    //     // subAccountCode: true,
    //     // bankAccount: true,
    //     // bankCode: true,
    //     // businessName: true,
    //   },
    // });
    // if (!deliveryPerson || !deliveryPerson.subAccountCode) {
    // throw new AppError(httpStatus.BAD_REQUEST, 'Delivery person not found');
    // }
    // Calculate payment split
    // const payment = await config.paystack.paystack.transaction.initialize({
    //   email: customerDetails.email,
    //   amount: parcel.parcelTransportPrice * 100, // Convert to kobo
    //   callback_url: 'http://localhost:3000/api/payments/verify',
    //   split: {
    //     type: 'percentage',
    //     subaccounts: [{ subaccount: deliveryPerson.subAccountCode, share: 65 }],
    //   },
    //   reference: `ref_${new Date().getTime()}`, // Add a unique reference
    //   name: customerDetails.fullName, // Add the customer's name
    // });
    // const payment = await config.paystack.paystack.transaction.initialize({
    //   email: customerDetails.email,
    //   amount: parcel.parcelTransportPrice * 100, // Convert to kobo
    //   split: {
    //     type: 'percentage',
    //     subaccounts: [{ subaccount: deliveryPerson.subAccountCode, share: 65 }],
    //   },
    //   reference: `ref_${new Date().getTime()}`, // Unique reference
    //   name: customerDetails.fullName, // Customer's name
    // });
    // console.log(payment, 'payment');
    // if (payment.status !== true) {
    //   throw new AppError(httpStatus.BAD_REQUEST, 'Payment authorization failed');
    // }
    // const updateParcel = await prisma.parcel.update({
    //   where: { id: parcelId },
    //   data: {
    //     // paymentStatus: PaymentStatus.REQUIRES_CAPTURE,
    //     referenceCode: payment.data.reference,
    //     parcelStatus: ParcelStatus.COMPLETED,
    //   },
    // });
    // console.log(updateParcel, 'payment')
    // if (!updateParcel) {
    //   throw new AppError(httpStatus.BAD_REQUEST, 'Parcel not updated');
    // }
    // return payment.data;
});
// Step 3: Capture the Payment
const capturePaymentRequestToPaystack = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { parcelId } = payload;
    // // Retrieve the parcel details
    // const parcel = await prisma.parcel.findUnique({
    //   where: {
    //     id: parcelId,
    //     referenceCode: { not: null },
    //   },
    // });
    // if (!parcel) {
    //   throw new AppError(httpStatus.BAD_REQUEST, 'Parcel not found');
    // }
    // Retrieve the payment details
    // const verification = await config.stripe.paystack.transaction.verify(
    //   parcel.referenceCode!,
    // );
    // console.log(verification, 'verification');
    // Save payment to database
    // const paymentUpdateInDb = await prisma.payment.create({
    //   data: {
    //     // paymentId: parcel.referenceCode!,
    //     // paystackRecipientCode: verification.data.split.split_code,
    //     paymentAmount: parcel.parcelTransportPrice,
    //     userId: userId,
    //     // deliveryPersonId: parcel.deliveryPersonId,
    //     paymentDate: new Date(),
    //     // parcelId,
    //     status: PaymentStatus.COMPLETED,
    //     // paystackCustomerCode: verification.data.customer.customer_code,
    //   },
    // });
    // if (!paymentUpdateInDb) {
    //   throw new AppError(httpStatus.BAD_REQUEST, 'Payment not saved');
    // }
    // Update parcel status
    // const updateParcel = await prisma.parcel.update({
    //   where: { id: parcelId },
    //   data: { paymentStatus: PaymentStatus.COMPLETED },
    // });
    // if (!updateParcel) {
    //   throw new AppError(httpStatus.BAD_REQUEST, 'Parcel not updated');
    // }
    // return verification;
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
const createDeliveryPersonRecipient = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield prisma_1.default.user.findUnique({
        where: { id: payload.deliveryId },
        select: {
            // businessName: true,
            // bankAccount: true,
            // bankCode: true,
            fullName: true,
        },
    });
    if (!user) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'User not found');
    }
    // Create a Paystack recipient
    // const subAccount = await config.paystack.paystack.subaccount.create({
    // business_name: user.businessName! ?? user.fullName,
    // settlement_bank: user.bankCode!,
    // account_number: user.bankAccount!,
    // percentage_charge: 65, // Delivery person gets 65%
    // });
    // console.log(subAccount, 'subAccount');
    // if(!subAccount){
    //   throw new AppError(httpStatus.NOT_ACCEPTABLE,'sub account create failed 1');
    // }
    // if (!subAccount.data.subaccount_code) {
    //  // console.log('if confidintion', subAccount.data);
    //   throw new AppError(httpStatus.NOT_ACCEPTABLE, 'sub account create failed');
    // }
    // const userUpdate = await prisma.user.update({
    // where: { id: payload.deliveryId },
    // data: { subAccountCode: subAccount.data.subaccount_code },
    // });
    // if (!userUpdate) {
    // throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    // }
    // return subAccount.data;
});
exports.StripeServices = {
    saveCardWithCustomerInfoIntoPaystack,
    authorizeAndSplitPayment,
    capturePaymentRequestToPaystack,
    saveNewCardWithExistingCustomerIntoStripe,
    getCustomerSavedCardsFromStripe,
    deleteCardFromCustomer,
    refundPaymentToCustomer,
    createPaymentIntentService,
    getCustomerDetailsFromStripe,
    getAllCustomersFromStripe,
    createDeliveryPersonRecipient,
};
