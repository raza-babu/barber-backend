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
exports.PaymentController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const payment_service_1 = require("./payment.service");
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const createAccount = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield payment_service_1.StripeServices.createDeliveryPersonRecipient(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Create account successfully',
        data: result,
    });
}));
// create a new customer with card
const saveCardWithCustomerInfo = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield payment_service_1.StripeServices.saveCardWithCustomerInfoIntoPaystack(req.body, user);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Create customer and save card successfully',
        data: result,
    });
}));
// Authorize the customer with the amount and send payment request
const authorizedPaymentWithSaveCard = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield payment_service_1.StripeServices.authorizeAndSplitPayment(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Authorized customer and payment request successfully',
        data: result,
    });
}));
// Capture the payment request and deduct the amount
const capturePaymentRequest = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    console.log(user, 'user from capture payment request');
    const result = yield payment_service_1.StripeServices.capturePaymentRequestToPaystack(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Capture payment request and payment deduct successfully',
        data: result,
    });
}));
// Save new card to existing customer
const saveNewCardWithExistingCustomer = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield payment_service_1.StripeServices.saveNewCardWithExistingCustomerIntoStripe(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'New card save successfully',
        data: result,
    });
}));
// Get all save cards for customer
const getCustomerSavedCards = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield payment_service_1.StripeServices.getCustomerSavedCardsFromStripe(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Retrieve customer cards successfully',
        data: result,
    });
}));
// Delete card from customer
const deleteCardFromCustomer = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const result = yield payment_service_1.StripeServices.deleteCardFromCustomer((_a = req.params) === null || _a === void 0 ? void 0 : _a.paymentMethodId);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Delete a card successfully',
        data: result,
    });
}));
// Refund payment to customer
const refundPaymentToCustomer = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield payment_service_1.StripeServices.refundPaymentToCustomer(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Refund payment successfully',
        data: result,
    });
}));
//payment from owner to rider
const createPaymentIntent = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield payment_service_1.StripeServices.createPaymentIntentService(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Stipe payment successful',
        data: result,
    });
}));
const getCustomerDetails = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield payment_service_1.StripeServices.getCustomerDetailsFromStripe(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Retrieve customer cards successfully',
        data: result,
    });
}));
const getAllCustomers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield payment_service_1.StripeServices.getAllCustomersFromStripe();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Retrieve customer details successfully',
        data: result,
    });
}));
// const handleWebHook = catchAsync( async (req: any, res: any) => {
//   const sig = req.headers['stripe-signature'] as string;
//   console.log(sig);
//   if (!sig) {
//     return sendResponse(res, {
//       statusCode: httpStatus.BAD_REQUEST,
//       success: false,
//       message: 'Missing Stripe signature header.',
//       data: null,
//     });
//   }
//   let event: Stripe.Event;
//   try {
//     event = Stripe.webhooks.constructEvent(
//       req.body,
//       sig,
//       config.stripe.stripe_webhook_secret as string
//     );
//   } catch (err) {
//     console.error('Webhook signature verification failed.', err);
//     return res.status(400).send('Webhook Error');
//   }
//   // Handle the event types
//   switch (event.type) {
//     case 'account.updated':
//       const account = event.data.object;
//       console.log(account, 'check account from webhook');
//       if (
//         account.charges_enabled &&
//         account.details_submitted &&
//         account.payouts_enabled
//       ) {
//         console.log(
//           'Onboarding completed successfully for account:',
//           account.id
//         );
//         const user = await prisma.user.update({
//           where: {
//             id: account.metadata?.userId,
//             email: account.email!,
//           },
//           data: {
//             onBoarding: true,
//           },
//         });
//         if(!user) {
//           return sendResponse(res, {
//             statusCode: httpStatus.NOT_FOUND,
//             success: false,
//             message: 'User not found',
//             data: null,
//           });
//         }
//         if(user) {
//         await prisma.user.update({
//           where: {
//             id: account.metadata?.userId,
//           },
//           data: {
//             stripeAccountUrl: null,
//           },
//         });
//       }
//       } else {
//         console.log('Onboarding incomplete for account:', account.id);
//       }
//       break;
//     case 'capability.updated':
//       console.log('Capability updated event received. Handle accordingly.');
//       break;
//     case 'financial_connections.account.created':
//       console.log(
//         'Financial connections account created event received. Handle accordingly.'
//       );
//       break;
//     case 'account.application.authorized':
//       const authorizedAccount = event.data.object;
//       console.log('Application authorized for account:', authorizedAccount.id);
//       // Add your logic to handle this event
//       break;
//     case 'customer.created':
//       const customer = event.data.object;
//       console.log('New customer created:', customer.id);
//       break;
//     case 'account.external_account.created':
//       const externalAccount = event.data.object;
//       console.log('External account created:', externalAccount);
//     default:
//       console.log(`Unhandled event type: ${event.type}`);
//   }
//   res.status(200).send('Event received');
// });
exports.PaymentController = {
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
    // handleWebHook
};
