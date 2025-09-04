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
const config_1 = __importDefault(require("../../../config"));
const prisma_1 = __importDefault(require("../../utils/prisma"));
const stripe_1 = __importDefault(require("stripe"));
const client_1 = require("@prisma/client");
// Initialize Stripe with your secret API key
const stripe = new stripe_1.default(config_1.default.stripe.stripe_secret_key, {
    apiVersion: '2025-07-30.basil',
});
const createAccount = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield payment_service_1.StripeServices.createAccountIntoStripe(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Create account successfully',
        data: result,
    });
}));
const createNewAccount = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield payment_service_1.StripeServices.createNewAccountIntoStripe(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Create new account successfully',
        data: result,
    });
}));
// create a new customer with card
const saveCardWithCustomerInfo = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield payment_service_1.StripeServices.saveCardWithCustomerInfoIntoStripe(user, req.body);
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
    const result = yield payment_service_1.StripeServices.capturePaymentRequestToStripe(user.id, req.body);
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
const handleWebHook = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c;
    const sig = req.headers['stripe-signature'];
    console.log(sig);
    if (!sig) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: 'Missing Stripe signature header.',
            data: null,
        });
    }
    let event;
    try {
        event = stripe_1.default.webhooks.constructEvent(req.body, sig, config_1.default.stripe.stripe_webhook_secret);
    }
    catch (err) {
        console.error('Webhook signature verification failed.', err);
        return res.status(400).send('Webhook Error');
    }
    // Handle the event types
    switch (event.type) {
        case 'account.updated':
            const account = event.data.object;
            console.log(account, 'check account from webhook');
            if (account.charges_enabled &&
                account.details_submitted &&
                account.payouts_enabled) {
                console.log('Onboarding completed successfully for account:', account.id);
                const user = yield prisma_1.default.user.update({
                    where: {
                        id: (_b = account.metadata) === null || _b === void 0 ? void 0 : _b.userId,
                        email: account.email,
                    },
                    data: {
                        onBoarding: true,
                    },
                });
                if (!user) {
                    return (0, sendResponse_1.default)(res, {
                        statusCode: http_status_1.default.NOT_FOUND,
                        success: false,
                        message: 'User not found',
                        data: null,
                    });
                }
                if (user) {
                    yield prisma_1.default.user.update({
                        where: {
                            id: (_c = account.metadata) === null || _c === void 0 ? void 0 : _c.userId,
                        },
                        data: {
                            stripeAccountUrl: null,
                        },
                    });
                }
            }
            else {
                console.log('Onboarding incomplete for account:', account.id);
            }
            break;
        case 'customer.subscription.created': {
            const subscription = event.data.object;
            // console.log(subscription, 'check subscription created');
            // find user by customerId
            const user = yield prisma_1.default.user.findFirst({
                where: { stripeCustomerId: subscription.customer },
            });
            if (user) {
                yield prisma_1.default.user.update({
                    where: { id: user.id },
                    data: {
                        isSubscribed: true,
                        subscriptionEnd: new Date(subscription.current_period_end * 1000), // Stripe gives timestamp in seconds
                    },
                });
                yield prisma_1.default.payment.updateMany({
                    where: {
                        stripeSubscriptionId: subscription.id,
                    },
                    data: {
                        status: client_1.PaymentStatus.COMPLETED,
                        invoiceId: subscription.latest_invoice,
                    },
                });
            }
            break;
        }
        case 'customer.subscription.updated': {
            const subscription = event.data.object;
            const user = yield prisma_1.default.user.findFirst({
                where: { stripeCustomerId: subscription.customer },
            });
            if (!user)
                break;
            // Find which plan this subscription is tied to
            const subscriptionOffer = yield prisma_1.default.subscriptionOffer.findFirst({
                where: { stripePriceId: subscription.items.data[0].price.id },
            });
            // Update the user with subscription details
            yield prisma_1.default.user.update({
                where: { id: user.id },
                data: {
                    isSubscribed: subscription.status === 'active',
                    subscriptionEnd: new Date(subscription.current_period_end * 1000),
                    subscriptionPlan: subscriptionOffer
                        ? subscriptionOffer.planType // map to actual plan
                        : client_1.SubscriptionPlanStatus.FREE,
                },
            });
            const paymentToUpdate = yield prisma_1.default.payment.findFirst({
                where: { stripeSubscriptionId: subscription.id },
            });
            // If subscription was canceled/refunded → trigger refund logic
            if (subscription.status === 'canceled') {
                // Optional: call Stripe refund API first, then update DB
                const refund = yield stripe.refunds.create({
                    payment_intent: paymentToUpdate === null || paymentToUpdate === void 0 ? void 0 : paymentToUpdate.paymentIntentId,
                });
                console.log(refund, 'check refund');
                yield prisma_1.default.payment.updateMany({
                    where: {
                        stripeSubscriptionId: subscription.id,
                        status: client_1.PaymentStatus.COMPLETED,
                    },
                    data: { status: client_1.PaymentStatus.REFUNDED },
                });
                yield prisma_1.default.user.update({
                    where: { id: user.id },
                    data: {
                        isSubscribed: false,
                        subscriptionEnd: new Date(), // Expired now
                        subscriptionPlan: client_1.SubscriptionPlanStatus.FREE,
                    },
                });
                yield prisma_1.default.userSubscription.updateMany({
                    where: {
                        userId: user.id,
                    },
                    data: { paymentStatus: client_1.PaymentStatus.REFUNDED, endDate: new Date() },
                });
                // console.log('Subscription canceled and refund processed:', refund);
            }
            break;
        }
        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            // console.log(subscription, 'check subscription deleted');
            const user = yield prisma_1.default.user.findFirst({
                where: { stripeCustomerId: subscription.customer },
            });
            console.log(user, 'check user from subscription deleted');
            const paymentToUpdate = yield prisma_1.default.payment.findFirst({
                where: { stripeSubscriptionId: subscription.id },
            });
            const refund = yield stripe.refunds.create({
                payment_intent: paymentToUpdate === null || paymentToUpdate === void 0 ? void 0 : paymentToUpdate.paymentIntentId,
            });
            // console.log(refund, 'check refund');
            if (user) {
                yield prisma_1.default.user.update({
                    where: { id: user.id },
                    data: {
                        isSubscribed: false,
                        subscriptionEnd: new Date(), // Expired now
                        subscriptionPlan: client_1.SubscriptionPlanStatus.FREE,
                    },
                });
                yield prisma_1.default.userSubscription.updateMany({
                    where: {
                        stripeSubscriptionId: subscription.id,
                        paymentStatus: client_1.PaymentStatus.COMPLETED,
                    },
                    data: { endDate: new Date(), paymentStatus: client_1.PaymentStatus.REFUNDED },
                });
                yield prisma_1.default.payment.updateMany({
                    where: {
                        stripeSubscriptionId: subscription.id,
                        status: client_1.PaymentStatus.COMPLETED,
                    },
                    data: { status: client_1.PaymentStatus.REFUNDED },
                });
            }
            break;
        }
        case 'capability.updated':
            console.log('Capability updated event received. Handle accordingly.');
            break;
        case 'invoice.paid': {
            // Stripe sends the invoice object
            const invoice = event.data.object;
            // Extract the invoice ID and PaymentIntent ID
            const invoiceId = invoice.id;
            const paymentIntentId = invoice.payment_intent;
            const subscriptionId = invoice.subscription;
            console.log(subscriptionId, 'check subscription id from invoice');
            // Find the related payment record in your DB
            const paymentRecord = yield prisma_1.default.payment.findUnique({
                where: {
                    stripeSubscriptionId: subscriptionId,
                    invoiceId: invoiceId,
                },
            });
            console.log(paymentRecord, 'check payment record for invoice');
            if (!paymentRecord) {
                console.log('No payment record found for invoice:', invoiceId);
                break;
            }
            yield prisma_1.default.payment.update({
                where: { id: paymentRecord.id },
                data: {
                    status: client_1.PaymentStatus.COMPLETED,
                    paymentIntentId: paymentIntentId,
                },
            });
            break;
        }
        case 'invoice.payment_failed':
            const failedInvoice = event.data.object;
            console.log('Invoice payment failed for invoice:', failedInvoice.id);
            // You can add logic here to handle failed invoice payments
            break;
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log('PaymentIntent was successful!', paymentIntent.id);
            // You can add logic here to handle successful payment intents
            break;
        case 'payment_method.attached':
            const paymentMethod = event.data.object;
            console.log('PaymentMethod was attached to a Customer!', paymentMethod.id);
            // You can add logic here to handle the attachment of a payment method
            break;
        case 'financial_connections.account.created':
            console.log('Financial connections account created event received. Handle accordingly.');
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
}));
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
    createNewAccount,
    handleWebHook,
};
