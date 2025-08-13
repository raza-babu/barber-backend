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
exports.termAndConditionService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createTermAndConditionIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.termAndCondition.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'termAndCondition not created');
    }
    return result;
});
const getTermAndConditionListFromDb = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.termAndCondition.findMany();
    if (result.length === 0) {
        return [];
    }
    return result;
});
const getTermAndConditionByIdFromDb = (termAndConditionId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.termAndCondition.findUnique({
        where: {
            id: termAndConditionId,
        }
    });
    if (!result) {
        return { message: 'TermAndCondition not found' };
    }
    return result;
});
const updateTermAndConditionIntoDb = (userId, termAndConditionId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.termAndCondition.update({
        where: {
            id: termAndConditionId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'termAndConditionId, not updated');
    }
    return result;
});
const deleteTermAndConditionItemFromDb = (userId, termAndConditionId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.termAndCondition.delete({
        where: {
            id: termAndConditionId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'termAndConditionId, not deleted');
    }
    return deletedItem;
});
exports.termAndConditionService = {
    createTermAndConditionIntoDb,
    getTermAndConditionListFromDb,
    getTermAndConditionByIdFromDb,
    updateTermAndConditionIntoDb,
    deleteTermAndConditionItemFromDb,
};
