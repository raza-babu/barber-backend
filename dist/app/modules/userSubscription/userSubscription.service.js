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
const emailSender_1 = __importDefault(require("../../utils/emailSender"));
// Initialize Stripe with your secret API key
const stripe = new stripe_1.default(config_1.default.stripe.stripe_secret_key, {
    apiVersion: '2025-07-30.basil',
});
const createUserSubscriptionIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Get user (outside transaction)
    var _a, _b;
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
    const subscription = yield stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: subscriptionOffer.stripePriceId }],
        default_payment_method: data.paymentMethodId,
        expand: ['latest_invoice.payment_intent'],
        metadata: {
            userId: userId,
            subscriptionOfferId: data.subscriptionOfferId,
            createdBy: 'api-direct', // Helps identify source
        },
    });
    // Extract details
    const latestInvoice = subscription.latest_invoice;
    const paymentIntent = latestInvoice === null || latestInvoice === void 0 ? void 0 : latestInvoice.payment_intent;
    console.log(latestInvoice, paymentIntent);
    if (subscription.status === 'incomplete' &&
        (paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.status) !== 'succeeded') {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subscription payment failed');
    }
    // Also handle other failure cases
    if (subscription.status === 'incomplete_expired' ||
        subscription.status === 'past_due') {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subscription payment failed');
    }
    console.log('Subscription status:', subscription.status);
    // After successful payment check, send invoice
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
                // paymentIntentId: paymentIntent?.id,
                invoiceId: latestInvoice === null || latestInvoice === void 0 ? void 0 : latestInvoice.id,
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
                subscriptionPlan: subscriptionOffer.planType,
                stripeSubscriptionId: subscription.id,
            },
        });
        return Object.assign(Object.assign({}, createdSubscription), { subscriptionId: subscription.id, paymentIntentId: paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.id });
    }), {
        // Optional: Increase timeout if needed (default is 5000ms)
        timeout: 10000, // 10 seconds
    });
    if (subscription.status === 'active' && subscription.latest_invoice) {
        try {
            console.log('Attempting to send invoice to customer:', subscription.latest_invoice);
            const invoiceId = typeof subscription.latest_invoice === 'string'
                ? subscription.latest_invoice
                : (_b = subscription.latest_invoice) === null || _b === void 0 ? void 0 : _b.id;
            console.log('Invoice ID to be sent:', invoiceId);
            if (typeof invoiceId === 'string') {
                yield stripe.invoices.sendInvoice(invoiceId);
                console.log('Invoice sent to customer:', invoiceId);
            }
            else {
                console.log('Invoice ID is undefined, cannot send invoice.');
            }
        }
        catch (error) {
            console.log('Invoice sending failed, but subscription is active:', error);
            // Optional: fallback to your own email system
            if (userCheck.email) {
                try {
                    console.log('Attempting fallback email to user:', userCheck.email);
                    yield (0, emailSender_1.default)('Your Subscription is Active', userCheck.email, `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 10px;
            padding: 10px;
            background-color: #f9f9f9;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px 20px;
            text-align: center;
            color: white;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .content {
            padding: 30px;
        }
        .greeting {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #2d3748;
        }
        .message {
            margin-bottom: 25px;
            font-size: 16px;
            color: #4a5568;
        }
        .invoice-section {
            background-color: #f7fafc;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #667eea;
            margin: 25px 0;
        }
        .invoice-title {
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 10px;
        }
        .invoice-link {
            display: inline-block;
            background-color: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin-top: 10px;
        }
        .invoice-link:hover {
            background-color: #5a67d8;
        }
        .support {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #718096;
        }
        .footer {
            background-color: #edf2f7;
            padding: 20px;
            text-align: center;
            font-size: 14px;
            color: #718096;
        }
        .signature {
            margin-top: 25px;
            color: #2d3748;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">✂️ Barber Shift App</div>
            <h1>Subscription Activated</h1>
        </div>
        
        <div class="content">
            <div class="greeting">Dear ${userCheck.fullName},</div>
            
            <div class="message">
                Thank you for subscribing! Your subscription is now active and you can start enjoying all the premium features immediately.
            </div>

            <div class="invoice-section">
                <div class="invoice-title">📄 Your Invoice</div>
                <p>You can view and download your invoice directly from our secure payment portal:</p>
                ${(latestInvoice === null || latestInvoice === void 0 ? void 0 : latestInvoice.hosted_invoice_url)
                        ? `<a href="${latestInvoice.hosted_invoice_url}" class="invoice-link" target="_blank">
                        View & Download Invoice
                      </a>`
                        : `<p style="color: #e53e3e;">Invoice link will be available shortly. If you don't receive it within 24 hours, please contact support.</p>`}
            </div>

            <div class="message">
                <strong>What's next?</strong><br>
                • Access your premium features immediately<br>
                • Manage your subscription from your account settings<br>
                • Receive automatic receipts for future payments
            </div>

            <div class="support">
                <strong>Need Help?</strong><br>
                If you have any questions or need assistance, our support team is here to help!<br>
                📧 Email: support@barbershiftapp.com<br>
                ⏰ Hours: Monday-Friday, 9AM-6PM
            </div>

            <div class="signature">
                Best regards,<br>
                <strong>The Barber Shift App Team</strong>
            </div>
        </div>

        <div class="footer">
            <p>©${new Date().getFullYear()} Barber Shift App. All rights reserved.</p>
            <p>You're receiving this email because you recently subscribed to our service.</p>
        </div>
    </div>
</body>
            </html>`);
                    console.log('Fallback email sent to user:', userCheck.email);
                }
                catch (emailError) {
                    console.log('Fallback email sending failed:', emailError);
                }
            }
        }
    }
    return result;
});
const getOwnerSubscriptionPlanFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield prisma_1.default.user.findUnique({
        where: { id: userId },
        select: {
            subscriptionPlan: true,
            isSubscribed: true,
            subscriptionEnd: true,
            stripeSubscriptionId: true,
            SaloonOwner: {
                select: {
                    shopName: true,
                    shopLogo: true,
                    userId: true,
                    isVerified: true,
                },
            },
            UserSubscription: {
                select: {
                    id: true,
                    startDate: true,
                    endDate: true,
                },
                where: { paymentStatus: client_1.PaymentStatus.COMPLETED },
            }
        },
    });
    if (!user) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    return user;
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
const cancelAutomaticRenewalIntoDb = (userId, userSubscriptionId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // Step 1: Find existing subscription for THIS USER
        const existing = yield tx.userSubscription.findFirst({
            where: {
                id: userSubscriptionId,
                userId: userId, // ← CRITICAL: Add user filter
                paymentStatus: client_1.PaymentStatus.COMPLETED,
            },
        });
        if (!existing) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Subscription not found');
        }
        if (!existing.stripeSubscriptionId) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Stripe subscription ID missing');
        }
        // Step 2: Update Stripe subscription to cancel at period end
        try {
            console.log('Setting Stripe subscription to cancel at period end:', existing.stripeSubscriptionId);
            yield stripe.subscriptions.update(existing.stripeSubscriptionId, {
                cancel_at_period_end: true,
            });
            console.log('Stripe subscription set to cancel at period end:', existing.stripeSubscriptionId);
        }
        catch (err) {
            console.error('Error updating Stripe subscription:', err);
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to update Stripe subscription');
        }
        // Step 3: Update user subscription record in DB
        const updatedSubscription = yield tx.userSubscription.update({
            where: {
                id: existing.id, // Use the ID from the found subscription
            },
            data: {
                // endDate remains unchanged
                paymentStatus: client_1.PaymentStatus.CANCELLED, // Mark as CANCELLED to indicate no renewal
            },
        });
        return {
            message: 'Subscription set to cancel at period end',
            subscription: updatedSubscription,
        };
    }));
    return result;
});
const deleteCustomerSubscriptionItemFromDb = (userId, saloonOwnerId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // Step 1: Find existing subscription
        const existing = yield tx.userSubscription.findFirst({
            where: {
                userId: saloonOwnerId,
                paymentStatus: client_1.PaymentStatus.COMPLETED,
            },
        });
        if (!existing) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Subscription not found');
        }
        // Step 2: Cancel Stripe subscription if exists
        if (existing.stripeSubscriptionId) {
            try {
                console.log('Cancelling Stripe subscription:', existing.stripeSubscriptionId);
                yield stripe.subscriptions.cancel(existing.stripeSubscriptionId);
                console.log('Stripe subscription cancelled:', existing.stripeSubscriptionId);
            }
            catch (err) {
                console.error('Error cancelling Stripe subscription:', err);
                // Don't throw - proceed with database cancellation
            }
        }
        console.log('Proceeding to cancel subscription in DB:', saloonOwnerId);
        // Step 3: Update user subscription record (soft delete)
        const updatedSubscription = yield tx.userSubscription.update({
            where: {
                userId: saloonOwnerId,
                stripeSubscriptionId: existing.stripeSubscriptionId,
            },
            data: {
                endDate: new Date(),
                paymentStatus: client_1.PaymentStatus.CANCELLED, // Use CANCELLED instead of REFUNDED
            },
        });
        console.log('Proceeding to cancel subscription in DB:', saloonOwnerId);
        // Step 4: Update related payments
        const paymentsToUpdate = yield tx.payment.findMany({
            where: {
                stripeSubscriptionId: existing.stripeSubscriptionId,
                status: client_1.PaymentStatus.COMPLETED,
            },
        });
        if (paymentsToUpdate.length > 0) {
            yield tx.payment.updateMany({
                where: {
                    stripeSubscriptionId: existing.stripeSubscriptionId,
                    status: client_1.PaymentStatus.COMPLETED,
                },
                data: {
                    status: client_1.PaymentStatus.CANCELLED, // Or REFUNDED if you actually process refunds
                },
            });
        }
        // Step 5: Check if user has other active subscriptions
        // const otherActiveSubscriptions = await tx.userSubscription.findFirst({
        //   where: {
        //     userId: userId,
        //     id: { not: subscriptionOfferId }, // Exclude this subscription
        //     endDate: { gt: new Date() },
        //     paymentStatus: PaymentStatus.COMPLETED,
        //   },
        // });
        // // Step 6: Update user status if no active subscriptions remain
        // if (!otherActiveSubscriptions) {
        //   await tx.user.update({
        //     where: { id: userId },
        //     data: {
        //       isSubscribed: false,
        //       subscriptionEnd: null,
        //     },
        //   });
        // }
        return {
            message: 'Subscription cancelled successfully',
            saloonOwnerId: saloonOwnerId,
        };
    }));
    return result;
});
const deleteUserSubscriptionItemFromDb = (userId, subscriptionOfferId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // Step 1: Find existing subscription for THIS USER
        const existing = yield tx.userSubscription.findFirst({
            where: {
                subscriptionOfferId: subscriptionOfferId,
                userId: userId, // ← CRITICAL: Add user filter
                paymentStatus: client_1.PaymentStatus.COMPLETED,
            },
        });
        if (!existing) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Subscription not found');
        }
        // Step 2: Cancel Stripe subscription if exists
        if (existing.stripeSubscriptionId) {
            try {
                console.log('Cancelling Stripe subscription:', existing.stripeSubscriptionId);
                // CANCEL IMMEDIATELY (no refund)
                // CORRECT: Use .cancel() with options to prevent refunds
                yield stripe.subscriptions.cancel(existing.stripeSubscriptionId, {
                    invoice_now: false, // Don't create final invoice
                    prorate: false, // Don't prorate refund
                });
                console.log('Stripe subscription cancelled immediately (no refund):', existing.stripeSubscriptionId);
            }
            catch (err) {
                console.error('Error cancelling Stripe subscription:', err);
                // Don't throw - proceed with database cancellation
            }
        }
        // Step 3: Update user subscription record (soft delete)
        const updatedSubscription = yield tx.userSubscription.update({
            where: {
                id: existing.id, // Use the ID from the found subscription
            },
            data: {
                endDate: new Date(),
                paymentStatus: client_1.PaymentStatus.CANCELLED,
            },
        });
        // Step 4: Update related payments to CANCELLED (not refunded)
        yield tx.payment.updateMany({
            where: {
                stripeSubscriptionId: existing.stripeSubscriptionId,
                status: client_1.PaymentStatus.COMPLETED,
            },
            data: {
                status: client_1.PaymentStatus.CANCELLED,
            },
        });
        // Step 5: Check if user has other active subscriptions
        const otherActiveSubscriptions = yield tx.userSubscription.findFirst({
            where: {
                userId: userId,
                id: { not: existing.id }, // Exclude this subscription
                endDate: { gt: new Date() },
                paymentStatus: client_1.PaymentStatus.COMPLETED,
            },
        });
        // Step 6: Update user status if no active subscriptions remain
        if (!otherActiveSubscriptions) {
            yield tx.user.update({
                where: { id: userId },
                data: {
                    isSubscribed: false,
                    subscriptionEnd: null,
                },
            });
        }
        return {
            message: 'Subscription cancelled successfully (no refund issued)',
            cancelledSubscriptionId: existing.id,
        };
    }));
    return result;
});
exports.userSubscriptionService = {
    createUserSubscriptionIntoDb,
    getUserSubscriptionListFromDb,
    getOwnerSubscriptionPlanFromDb,
    getUserSubscriptionByIdFromDb,
    updateUserSubscriptionIntoDb,
    cancelAutomaticRenewalIntoDb,
    deleteUserSubscriptionItemFromDb,
    deleteCustomerSubscriptionItemFromDb,
};
