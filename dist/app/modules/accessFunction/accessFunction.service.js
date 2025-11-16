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
exports.accessFunctionService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createAccessFunctionIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.accessFunction.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'accessFunction not created');
    }
    return result;
});
const getAccessFunctionListFromDb = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.accessFunction.findMany();
    if (result.length === 0) {
        return [];
    }
    return result;
});
const getAccessFunctionByIdFromDb = (accessFunctionId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.accessFunction.findUnique({
        where: {
            id: accessFunctionId,
        },
    });
    if (!result) {
        return { message: 'AccessFunction item is not found' };
    }
    return result;
});
const updateAccessFunctionIntoDb = (userId, accessFunctionId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.accessFunction.update({
        where: {
            id: accessFunctionId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'accessFunction item is not updated');
    }
    return result;
});
const deleteAccessFunctionItemFromDb = (userId, accessFunctionId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.accessFunction.delete({
        where: {
            id: accessFunctionId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'accessFunctionId, not deleted');
    }
    return deletedItem;
});
exports.accessFunctionService = {
    createAccessFunctionIntoDb,
    getAccessFunctionListFromDb,
    getAccessFunctionByIdFromDb,
    updateAccessFunctionIntoDb,
    deleteAccessFunctionItemFromDb,
};
