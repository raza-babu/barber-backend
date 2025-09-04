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
    // 1. Get user (outside transaction)
    var _a;
    const existingSubscription = yield prisma_1.default.userSubscription.findFirst({
        where: {
            userId: userId,
            endDate: {
                gt: new Date(),
            },
            paymentStatus: client_1.PaymentStatus.COMPLETED,
        },
    });
    if (existingSubscription) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'An active subscription already exists for this user');
    }
    const userCheck = yield prisma_1.default.user.findUnique({
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
    if (!userCheck)
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'User not found or inactive');
    // 2. Ensure Stripe customer exists (outside transaction)
    let stripeCustomerId = userCheck.stripeCustomerId;
    if (!stripeCustomerId) {
        const customer = yield stripe.customers.create({
            email: userCheck.email,
            name: userCheck.fullName,
            address: {
                city: (_a = userCheck.address) !== null && _a !== void 0 ? _a : 'City',
                country: 'US',
            },
            metadata: { userId: userCheck.id, role: userCheck.role },
        });
        // Update DB (outside transaction)
        yield prisma_1.default.user.update({
            where: { id: userId },
            data: { stripeCustomerId: customer.id },
        });
        stripeCustomerId = customer.id;
    }
    // 3. Attach payment method (outside transaction)
    try {
        yield stripe.paymentMethods.attach(data.paymentMethodId, {
            customer: stripeCustomerId,
        });
    }
    catch (err) {
        if (err.code !== 'resource_already_attached')
            throw err;
    }
    // 4. Set default payment method (outside transaction)
    yield stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: data.paymentMethodId },
    });
    // 5. Fetch subscription offer (outside transaction)
    const subscriptionOffer = yield prisma_1.default.subscriptionOffer.findUnique({
        where: { id: data.subscriptionOfferId },
        include: { creator: { select: { stripeCustomerId: true } } },
    });
    if (!(subscriptionOffer === null || subscriptionOffer === void 0 ? void 0 : subscriptionOffer.stripePriceId)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subscription offer or price not found');
    }
    // check if user is trying to subscribe to their own plan
    if (subscriptionOffer.creator.stripeCustomerId === stripeCustomerId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'You cannot subscribe to your own subscription plan');
    }
    // check in stripe that the user is already not subscribed to this plan
    const existingStripeSubscriptions = yield stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'active',
        expand: ['data.items'],
    });
    const isAlreadySubscribed = existingStripeSubscriptions.data.some(sub => sub.items.data.some(item => item.price.id === subscriptionOffer.stripePriceId));
    if (isAlreadySubscribed) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'You are already subscribed to this plan');
    }
    // 6. Create subscription in Stripe (outside transaction)
    const subscription = (yield stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: subscriptionOffer.stripePriceId }],
        default_payment_method: data.paymentMethodId,
        expand: ['latest_invoice.payment_intent'],
    }));
    // Extract details
    const latestInvoice = subscription.latest_invoice;
    const paymentIntent = latestInvoice === null || latestInvoice === void 0 ? void 0 : latestInvoice.payment_intent;
    console.log(latestInvoice, paymentIntent);
    if (subscription.status === 'incomplete' &&
        (paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.status) !== 'succeeded') {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subscription payment failed');
    }
    const subscriptionWithPeriod = subscription;
    // 7. ONLY database operations go inside the transaction
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // Convert Stripe Unix timestamps to JavaScript Date objects
        const startDate = subscriptionWithPeriod.current_period_start
            ? new Date(subscriptionWithPeriod.current_period_start * 1000)
            : new Date();
        const endDate = subscriptionWithPeriod.current_period_end
            ? new Date(subscriptionWithPeriod.current_period_end * 1000)
            : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const createdSubscription = yield tx.userSubscription.create({
            data: {
                userId: userCheck.id,
                subscriptionOfferId: subscriptionOffer.id,
                startDate: startDate,
                endDate: endDate,
                stripeSubscriptionId: subscription.id,
                paymentStatus: client_1.PaymentStatus.COMPLETED,
            },
        });
        yield tx.payment.create({
            data: {
                stripeSubscriptionId: subscription.id,
                paymentAmount: subscriptionOffer.price,
                amountProvider: stripeCustomerId,
                status: client_1.PaymentStatus.COMPLETED,
                user: {
                    connect: { id: userId },
                },
            },
        });
        yield tx.user.update({
            where: { id: userId },
            data: {
                isSubscribed: true,
                subscriptionEnd: endDate,
            },
        });
        return Object.assign(Object.assign({}, createdSubscription), { subscriptionId: subscription.id, paymentIntentId: paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.id });
    }), {
        // Optional: Increase timeout if needed (default is 5000ms)
        timeout: 10000, // 10 seconds
    });
    return result;
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
    // Step 1: find user subscription (outside transaction)
    const existing = yield prisma_1.default.userSubscription.findFirst({
        where: {
            id: userSubscriptionId,
            userId,
            // Remove the endDate filter to find both active and expired
        },
    });
    if (!existing) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Subscription not found');
    }
    // Optional: Add business logic if you only want to allow renewing near expiration
    if (existing.endDate > new Date()) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subscription is still active, cannot renew yet');
    }
    // Step 2: find user (outside transaction)
    const user = yield prisma_1.default.user.findUnique({
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
    // Step 3: find subscription offer (outside transaction)
    const subscriptionOffer = yield prisma_1.default.subscriptionOffer.findUnique({
        where: { id: data.subscriptionOfferId },
        include: {
            creator: {
                select: {
                    stripeCustomerId: true,
                },
            },
        },
    });
    if (!(subscriptionOffer === null || subscriptionOffer === void 0 ? void 0 : subscriptionOffer.stripePriceId)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subscription offer or price not found');
    }
    // Step 4: Handle payment method (outside transaction)
    try {
        yield stripe.paymentMethods.attach(data.paymentMethodId, {
            customer: user.stripeCustomerId,
        });
    }
    catch (err) {
        if (err.code !== 'resource_already_attached')
            throw err;
    }
    // Set default payment method
    yield stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: { default_payment_method: data.paymentMethodId },
    });
    // Step 5: renew subscription in Stripe (outside transaction)
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
    if (subscription.status === 'incomplete' &&
        (paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.status) !== 'succeeded') {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subscription payment failed');
    }
    // Type assertion for subscription dates
    const subscriptionWithPeriod = subscription;
    // Step 6: ONLY database operations inside transaction
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // Convert Stripe Unix timestamps to JavaScript Date objects
        const startDate = subscriptionWithPeriod.current_period_start
            ? new Date(subscriptionWithPeriod.current_period_start * 1000)
            : new Date();
        const endDate = subscriptionWithPeriod.current_period_end
            ? new Date(subscriptionWithPeriod.current_period_end * 1000)
            : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        // Update user subscription in DB
        const updatedSubscription = yield tx.userSubscription.update({
            where: { id: userSubscriptionId },
            data: {
                subscriptionOfferId: data.subscriptionOfferId,
                startDate: startDate,
                endDate: endDate,
                stripeSubscriptionId: subscription.id,
                paymentStatus: client_1.PaymentStatus.COMPLETED,
            },
        });
        // Record payment
        yield tx.payment.create({
            data: {
                userId: userId,
                stripeSubscriptionId: subscription.id,
                paymentAmount: subscriptionOffer.price,
                amountProvider: user.stripeCustomerId,
                status: client_1.PaymentStatus.COMPLETED,
            },
        });
        // Update user status
        yield tx.user.update({
            where: { id: userId },
            data: {
                isSubscribed: true,
                subscriptionEnd: endDate,
            },
        });
        return Object.assign(Object.assign({}, updatedSubscription), { subscriptionId: subscription.id, paymentIntentId: paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.id });
    }), {
        timeout: 10000, // Optional: Increase timeout if needed
    });
    return result;
});
const deleteUserSubscriptionItemFromDb = (userId, userSubscriptionId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // Step 1: Find existing subscription
        const existing = yield tx.userSubscription.findFirst({
            where: {
                id: userSubscriptionId,
                userId,
            },
        });
        if (!existing) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Subscription not found');
        }
        // Step 2: Cancel Stripe subscription if exists
        if (existing.stripeSubscriptionId) {
            try {
                yield stripe.subscriptions.cancel(existing.stripeSubscriptionId);
            }
            catch (err) {
                // Log error but proceed with deletion
                console.error('Error cancelling Stripe subscription:', err);
            }
        }
        // Step 3: Delete user subscription record
        yield tx.userSubscription.update({
            where: { id: userSubscriptionId },
            data: { endDate: new Date(), paymentStatus: client_1.PaymentStatus.REFUNDED }, // Soft delete by setting endDate to now
        });
        // Step 4: Check if user has other active subscriptions
        const activeSubscriptions = yield tx.userSubscription.findUnique({
            where: {
                userId,
                stripeSubscriptionId: existing.stripeSubscriptionId,
                endDate: {
                    gt: new Date(),
                },
            },
        });
        const checkPaymentStatus = yield prisma_1.default.payment.findUnique({
            where: {
                userId: existing.userId,
                stripeSubscriptionId: existing.stripeSubscriptionId,
                status: client_1.PaymentStatus.COMPLETED,
            },
        });
        if (!checkPaymentStatus) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Payment not found');
        }
        const updatePaymentStatus = yield tx.payment.update({
            where: {
                userId: existing.userId,
                stripeSubscriptionId: existing.stripeSubscriptionId,
            },
            data: { status: client_1.PaymentStatus.REFUNDED },
        });
        if (!updatePaymentStatus) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Payment not updated');
        }
        // Step 5: Update user status if no active subscriptions remain
        if (!activeSubscriptions) {
            yield tx.user.update({
                where: { id: userId },
                data: {
                    isSubscribed: false,
                    subscriptionEnd: null,
                },
            });
        }
        return { message: 'Subscription cancelled successfully' };
    }));
    return result;
});
exports.userSubscriptionService = {
    createUserSubscriptionIntoDb,
    getUserSubscriptionListFromDb,
    getUserSubscriptionByIdFromDb,
    updateUserSubscriptionIntoDb,
    deleteUserSubscriptionItemFromDb,
};
