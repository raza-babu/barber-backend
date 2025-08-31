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
exports.subscriptionOfferService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const stripe_1 = __importDefault(require("stripe"));
const config_1 = __importDefault(require("../../../config"));
// Initialize Stripe with your secret API key
const stripe = new stripe_1.default(config_1.default.stripe.stripe_secret_key, {
    apiVersion: '2025-08-27.basil',
});
const createSubscriptionOfferIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield tx.subscriptionOffer.create({
            data: Object.assign(Object.assign({}, data), { userId: userId }),
        });
        if (!result) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'subscriptionOffer not created');
        }
        // Create a product in Stripe for this subscription offer
        let product;
        try {
            product = yield stripe.products.create({
                name: result.title,
                description: result.description,
            });
        }
        catch (err) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Stripe product not created!');
        }
        let price;
        try {
            price = yield stripe.prices.create({
                unit_amount: result.price * 100, // Amount in cents
                currency: 'usd',
                recurring: {
                    interval: 'month',
                },
                product: product.id,
            });
        }
        catch (err) {
            // Optionally, you could delete the product if price creation fails
            yield stripe.products.del(product.id);
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Stripe price not created!');
        }
        console.log('Success! Here is your starter subscription product id: ' + product.id);
        console.log('Success! Here is your starter subscription price id: ' + price.id);
        const updatedResult = yield tx.subscriptionOffer.update({
            where: {
                id: result.id,
                userId: userId,
            },
            data: {
                stripeProductId: product.id,
                stripePriceId: price.id,
            },
        });
        if (!updatedResult) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'subscriptionOffer not updated with Stripe IDs');
        }
        return Object.assign(Object.assign({}, result), { product,
            price, stripeProductId: product.id, stripePriceId: price.id });
    }));
});
const getSubscriptionOfferListFromDb = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.subscriptionOffer.findMany();
    if (result.length === 0) {
        return [];
    }
    const stripeProductIds = yield stripe.products.list({
        limit: 100,
    });
    const stripePriceIds = yield stripe.prices.list({
        limit: 100,
    });
    const resultWithStripeData = result.map(offer => {
        const product = stripeProductIds.data.find(prod => prod.id === offer.stripeProductId);
        const price = stripePriceIds.data.find(prc => prc.id === offer.stripePriceId);
        return Object.assign({}, offer);
    });
    return resultWithStripeData;
});
const getSubscriptionOfferByIdFromDb = (subscriptionOfferId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.subscriptionOffer.findUnique({
        where: {
            id: subscriptionOfferId,
        },
    });
    if (!result) {
        return { message: 'SubscriptionOffer not found' };
    }
    // const product = await stripe.products.retrieve(result.stripeProductId!);
    // const price = await stripe.prices.retrieve(result.stripePriceId!);
    return result;
});
const updateSubscriptionOfferIntoDb = (userId, subscriptionOfferId, data) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // Step 1: find subscription offer
        const existing = yield tx.subscriptionOffer.findFirst({
            where: {
                id: subscriptionOfferId,
                userId,
            },
        });
        if (!existing) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Subscription offer not found');
        }
        if (data.duration) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Duration cannot be updated');
        }
        // Step 2: update in DB first
        const result = yield tx.subscriptionOffer.update({
            where: { id: subscriptionOfferId },
            data: Object.assign({}, data),
        });
        // Step 3: update Stripe product
        let product;
        try {
            product = yield stripe.products.update(result.stripeProductId, {
                name: result.title,
                description: result.description,
            });
        }
        catch (err) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Stripe product not updated!');
        }
        // Step 4: handle Stripe price
        let newPrice = null;
        // If user updated price → create new Stripe price
        if (data.price && data.price > 0 && data.price !== existing.price) {
            try {
                newPrice = yield stripe.prices.create({
                    unit_amount: data.price * 100,
                    currency: result.currency || 'usd',
                    recurring: { interval: 'month' },
                    product: result.stripeProductId,
                });
            }
            catch (err) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Stripe price not created!');
            }
            // Deactivate the old price in Stripe
            if (existing.stripePriceId) {
                try {
                    yield stripe.prices.update(existing.stripePriceId, { active: false });
                }
                catch (err) {
                    // Log but don't block the update if deactivation fails
                    console.error('Failed to deactivate old Stripe price:', err);
                }
            }
            // Update DB with new Stripe price id
            yield tx.subscriptionOffer.update({
                where: { id: subscriptionOfferId },
                data: { stripePriceId: newPrice.id },
            });
        }
        else {
            // Otherwise reuse existing active price
            const prices = yield stripe.prices.list({
                product: result.stripeProductId,
                active: true,
                limit: 1,
            });
            if (prices.data.length === 0) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'No Stripe price found!');
            }
            newPrice = prices.data[0];
        }
        console.log('Updated Stripe product id:', product.id);
        console.log('Stripe price id:', newPrice.id);
        return Object.assign(Object.assign({}, result), { stripePriceId: newPrice.id });
    }));
});
const deleteSubscriptionOfferItemFromDb = (userId, subscriptionOfferId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const isSuperAdmin = yield tx.user.findFirst({
            where: {
                id: userId,
                role: client_1.UserRoleEnum.SUPER_ADMIN,
                status: client_1.UserStatus.ACTIVE,
            },
        });
        if (!isSuperAdmin) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Only super admin can delete subscription offers');
        }
        // Find the subscription offer first
        const existing = yield tx.subscriptionOffer.findUnique({
            where: {
                id: subscriptionOfferId,
                // userId: userId,
            },
        });
        if (!existing) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'subscriptionOfferId not found');
        }
        // Delete the subscription offer in DB
        const deletedItem = yield tx.subscriptionOffer.delete({
            where: {
                id: subscriptionOfferId,
                // userId: userId,
            },
        });
        if (!deletedItem) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'subscriptionOfferId not deleted');
        }
        // Delete the product from Stripe
        let deleteFromStripe;
        try {
            deleteFromStripe = yield stripe.products.update(existing.stripeProductId, {
                active: false,
            });
            if (!deleteFromStripe.active === false) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Stripe product not deleted!');
            }
        }
        catch (err) {
            // Throwing here will rollback the transaction
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Stripe product not deleted!');
        }
        return Object.assign(Object.assign({}, deletedItem), { stripeProduct: deleteFromStripe });
    }));
});
exports.subscriptionOfferService = {
    createSubscriptionOfferIntoDb,
    getSubscriptionOfferListFromDb,
    getSubscriptionOfferByIdFromDb,
    updateSubscriptionOfferIntoDb,
    deleteSubscriptionOfferItemFromDb,
};
