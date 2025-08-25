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
exports.paymentService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createPaymentIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.payment.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'payment not created');
    }
    return result;
});
const getPaymentListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.payment.findMany();
    if (result.length === 0) {
        return { message: 'No payment found' };
    }
    return result;
});
const getPaymentByIdFromDb = (userId, paymentId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.payment.findUnique({
        where: {
            id: paymentId,
        }
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'payment not found');
    }
    return result;
});
const updatePaymentIntoDb = (userId, paymentId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.payment.update({
        where: {
            id: paymentId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'paymentId, not updated');
    }
    return result;
});
const deletePaymentItemFromDb = (userId, paymentId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.payment.delete({
        where: {
            id: paymentId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'paymentId, not deleted');
    }
    return deletedItem;
});
exports.paymentService = {
    createPaymentIntoDb,
    getPaymentListFromDb,
    getPaymentByIdFromDb,
    updatePaymentIntoDb,
    deletePaymentItemFromDb,
};
