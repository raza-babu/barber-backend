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
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createSubscriptionOfferIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.subscriptionOffer.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'subscriptionOffer not created');
    }
    return result;
});
const getSubscriptionOfferListFromDb = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.subscriptionOffer.findMany();
    if (result.length === 0) {
        return [];
    }
    return result;
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
    return result;
});
const updateSubscriptionOfferIntoDb = (userId, subscriptionOfferId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.subscriptionOffer.update({
        where: {
            id: subscriptionOfferId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'subscriptionOfferId, not updated');
    }
    return result;
});
const deleteSubscriptionOfferItemFromDb = (userId, subscriptionOfferId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.subscriptionOffer.delete({
        where: {
            id: subscriptionOfferId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'subscriptionOfferId, not deleted');
    }
    return deletedItem;
});
exports.subscriptionOfferService = {
    createSubscriptionOfferIntoDb,
    getSubscriptionOfferListFromDb,
    getSubscriptionOfferByIdFromDb,
    updateSubscriptionOfferIntoDb,
    deleteSubscriptionOfferItemFromDb,
};
