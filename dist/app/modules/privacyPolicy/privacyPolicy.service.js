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
exports.privacyPolicyService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createPrivacyPolicyIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.privacyPolicy.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Privacy & Policy is not created');
    }
    return result;
});
const getPrivacyPolicyListFromDb = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.privacyPolicy.findMany();
    if (result.length === 0) {
        return [];
    }
    return result;
});
const getPrivacyPolicyByIdFromDb = (privacyPolicyId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.privacyPolicy.findUnique({
        where: {
            id: privacyPolicyId,
        }
    });
    if (!result) {
        return { message: 'Privacy & Policy is not not found' };
    }
    return result;
});
const updatePrivacyPolicyIntoDb = (userId, privacyPolicyId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.privacyPolicy.update({
        where: {
            id: privacyPolicyId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'privacyPolicyId, not updated');
    }
    return result;
});
const deletePrivacyPolicyItemFromDb = (userId, privacyPolicyId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.privacyPolicy.delete({
        where: {
            id: privacyPolicyId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'privacyPolicyId, not deleted');
    }
    return deletedItem;
});
exports.privacyPolicyService = {
    createPrivacyPolicyIntoDb,
    getPrivacyPolicyListFromDb,
    getPrivacyPolicyByIdFromDb,
    updatePrivacyPolicyIntoDb,
    deletePrivacyPolicyItemFromDb,
};
