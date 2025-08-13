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
exports.faqService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createFaqIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.faq.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'faq not created');
    }
    return result;
});
const getFaqListFromDb = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.faq.findMany();
    if (result.length === 0) {
        return [];
    }
    return result;
});
const getFaqByIdFromDb = (faqId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.faq.findUnique({
        where: {
            id: faqId,
        },
    });
    if (!result) {
        return { message: 'Faq not found' };
    }
    return result;
});
const updateFaqIntoDb = (userId, faqId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.faq.update({
        where: {
            id: faqId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'faqId, not updated');
    }
    return result;
});
const deleteFaqItemFromDb = (userId, faqId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.faq.delete({
        where: {
            id: faqId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'faqId, not deleted');
    }
    return deletedItem;
});
exports.faqService = {
    createFaqIntoDb,
    getFaqListFromDb,
    getFaqByIdFromDb,
    updateFaqIntoDb,
    deleteFaqItemFromDb,
};
