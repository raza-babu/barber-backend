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
exports.userSubscriptionService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const stripe_1 = __importDefault(require("stripe"));
const config_1 = __importDefault(require("../../../config"));
// Initialize Stripe with your secret API key
const stripe = new stripe_1.default(config_1.default.stripe.stripe_secret_key, {
    apiVersion: '2025-07-30.basil',
});
const createUserSubscriptionIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        // 1. Verify user
        const userCheck = yield tx.user.findUnique({
            where: {
                id: userId,
                role: client_1.UserRoleEnum.SALOON_OWNER,
                status: client_1.UserStatus.ACTIVE,
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                address: true,
                status: true,
                stripeCustomerId: true,
            },
        });
        if (!userCheck) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'User not found or inactive');
        }
        // 2. Ensure Stripe Customer exists
        if (!userCheck.stripeCustomerId) {
            const customer = yield stripe.customers.create({
                email: userCheck.email,
                name: userCheck.fullName,
                address: {
                    city: (_a = userCheck.address) !== null && _a !== void 0 ? _a : 'City',
                    country: 'America',
                },
                metadata: { userId: userCheck.id, role: userCheck.role },
            });
            yield tx.user.update({
                where: { id: userId },
                data: { stripeCustomerId: customer.id },
            });
            userCheck.stripeCustomerId = customer.id;
        }
        // 3. Attach the payment method to the customer
        try {
            yield stripe.paymentMethods.attach(data.paymentMethodId, {
                customer: userCheck.stripeCustomerId,
            });
        }
        catch (err) {
            if (err.code !== 'resource_already_attached')
                throw err;
        }
        // 4. Set it as the default payment method
        yield stripe.customers.update(userCheck.stripeCustomerId, {
            invoice_settings: {
                default_payment_method: data.paymentMethodId,
            },
        });
        // 5. Get subscription offer
        const subscriptionOffer = yield tx.subscriptionOffer.findUnique({
            where: { id: data.subscriptionOfferId },
            include: {
                creator: {
                    select: {
                        stripeCustomerId: true
                    }
                }
            }
        });
        if (!(subscriptionOffer === null || subscriptionOffer === void 0 ? void 0 : subscriptionOffer.stripePriceId)) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subscription offer or price not found');
        }
        // 6. Create the subscription in Stripe
        const subscription = yield stripe.subscriptions.create({
            customer: userCheck.stripeCustomerId,
            items: [{ price: subscriptionOffer.stripePriceId }],
            default_payment_method: data.paymentMethodId,
            expand: ['latest_invoice.payment_intent'],
        });
        if (!subscription) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subscription not created');
        }
        // IMPORTANT: Subscription may start as `incomplete` until invoice is paid
        const latestInvoice = subscription.latest_invoice;
        const paymentIntent = latestInvoice === null || latestInvoice === void 0 ? void 0 : latestInvoice.payment_intent;
        if (subscription.status === 'incomplete' && (paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.status) !== 'succeeded') {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subscription payment failed');
        }
        // 7. Save subscription to DB
        const result = yield tx.userSubscription.create({
            data: {
                userId: userId,
                subscriptionOfferId: data.subscriptionOfferId,
                startDate: new Date(),
                endDate: new Date(subscription.current_period_end * 1000),
                stripeSubscriptionId: subscription.id,
                paymentStatus: client_1.PaymentStatus.COMPLETED,
            },
        });
        // 8. Record payment
        yield tx.payment.create({
            data: {
                userId: userId,
                stripePaymentIntentId: (_b = paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.id) !== null && _b !== void 0 ? _b : null,
                paymentAmount: subscriptionOffer.price,
                stripeCustomerIdProvider: userCheck.stripeCustomerId,
                // stripeAccountIdReceiver: subscriptionOffer.creator.stripeCustomerId!,
                status: client_1.PaymentStatus.COMPLETED,
            },
        });
        // 9. Update user status
        yield tx.user.update({
            where: { id: userId },
            data: {
                isSubscribed: true,
                subscriptionEnd: result.endDate,
            },
        });
        return Object.assign(Object.assign({}, result), { subscriptionId: subscription.id, paymentIntentId: paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.id });
    }));
});
const getUserSubscriptionListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.userSubscription.findMany({
        include: {
            subscriptionOffer: true,
        },
    });
    if (result.length === 0) {
        return { message: 'No userSubscription found' };
    }
    return result.map(item => (Object.assign(Object.assign({}, item), { subscriptionOffer: item.subscriptionOffer })));
});
const getUserSubscriptionByIdFromDb = (userId, userSubscriptionId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.userSubscription.findUnique({
        where: {
            id: userSubscriptionId,
        },
        include: {
            subscriptionOffer: true,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'userSubscription not found');
    }
    return Object.assign(Object.assign({}, result), { subscriptionOffer: result.subscriptionOffer });
});
const updateUserSubscriptionIntoDb = (userId, userSubscriptionId, data) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _c;
        // Step 1: find user subscription
        const existing = yield tx.userSubscription.findFirst({
            where: {
                id: userSubscriptionId,
                userId,
            },
        });
        if (!existing) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User subscription not found');
        }
        // Step 2: find user
        const user = yield tx.user.findUnique({
            where: {
                id: userId,
            },
        });
        if (!user) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
        }
        if (!user.stripeCustomerId) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Stripe customer not found');
        }
        // Step 3: find subscription offer
        const subscriptionOffer = yield tx.subscriptionOffer.findUnique({
            where: { id: data.subscriptionOfferId },
            include: {
                creator: {
                    select: {
                        stripeCustomerId: true
                    }
                }
            }
        });
        if (!(subscriptionOffer === null || subscriptionOffer === void 0 ? void 0 : subscriptionOffer.stripePriceId)) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subscription offer or price not found');
        }
        // Step 4: renew subscription in Stripe
        const subscription = yield stripe.subscriptions.create({
            customer: user.stripeCustomerId,
            items: [{ price: subscriptionOffer.stripePriceId }],
            default_payment_method: data.paymentMethodId,
            expand: ['latest_invoice.payment_intent'],
        });
        if (!subscription) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subscription not created');
        }
        // IMPORTANT: Subscription may start as `incomplete` until invoice is paid
        const latestInvoice = subscription.latest_invoice;
        const paymentIntent = latestInvoice === null || latestInvoice === void 0 ? void 0 : latestInvoice.payment_intent;
        if (subscription.status === 'incomplete' && (paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.status) !== 'succeeded') {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subscription payment failed');
        }
        // Step 5: update user subscription in DB
        const result = yield tx.userSubscription.update({
            where: { id: userSubscriptionId },
            data: {
                subscriptionOfferId: data.subscriptionOfferId,
                startDate: new Date(),
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
                stripeSubscriptionId: subscription.id,
                paymentStatus: client_1.PaymentStatus.COMPLETED,
            },
        });
        // Step 6: record payment
        yield tx.payment.create({
            data: {
                userId: userId,
                stripePaymentIntentId: (_c = paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.id) !== null && _c !== void 0 ? _c : null,
                paymentAmount: subscriptionOffer.price,
                stripeCustomerIdProvider: user.stripeCustomerId,
                // stripeAccountIdReceiver: subscriptionOffer.creator.stripeCustomerId!,
                status: client_1.PaymentStatus.COMPLETED,
            },
        });
        // Step 7: update user status
        yield tx.user.update({
            where: { id: userId },
            data: {
                isSubscribed: true,
                subscriptionEnd: result.endDate,
            },
        });
        return Object.assign(Object.assign({}, result), { subscriptionId: subscription.id, paymentIntentId: paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.id });
    }));
});
const deleteUserSubscriptionItemFromDb = (userId, userSubscriptionId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.userSubscription.delete({
        where: {
            id: userSubscriptionId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'userSubscriptionId, not deleted');
    }
    return deletedItem;
});
exports.userSubscriptionService = {
    createUserSubscriptionIntoDb,
    getUserSubscriptionListFromDb,
    getUserSubscriptionByIdFromDb,
    updateUserSubscriptionIntoDb,
    deleteUserSubscriptionItemFromDb,
};
