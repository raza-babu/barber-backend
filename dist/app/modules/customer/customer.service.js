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
exports.customerService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createCustomerIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonOwner.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'customer not created');
    }
    return result;
});
const getAllSaloonListFromDb = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonOwner.findMany({
        where: {
            isVerified: true,
        },
        select: {
            id: true,
            userId: true,
            shopName: true,
            shopAddress: true,
            shopImages: true,
            isVerified: true,
            shopLogo: true,
            shopVideo: true,
        },
    });
    if (result.length === 0) {
        return [];
    }
    return result;
});
const getSaloonAllServicesListFromDb = (saloonOwnerId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.service.findMany({
        where: {
            saloonOwnerId: saloonOwnerId,
            isActive: true,
        },
        select: {
            id: true,
            serviceName: true,
            price: true,
            duration: true,
            saloonOwnerId: true,
            saloon: {
                select: {
                    shopName: true,
                    shopLogo: true,
                    shopAddress: true,
                    user: {
                        select: {
                            fullName: true,
                            email: true,
                            phoneNumber: true,
                        },
                    },
                },
            },
        },
    });
    if (result.length === 0) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'No services found');
    }
    return result.map(service => ({
        id: service.id,
        name: service.serviceName,
        price: service.price,
        duration: service.duration,
        // isActive: service.isActive,   
        saloonOwnerId: service.saloonOwnerId,
        saloon: {
            shopName: service.saloon.shopName,
            shopLogo: service.saloon.shopLogo,
            shopAddress: service.saloon.shopAddress,
            ownerName: service.saloon.user.fullName,
            ownerEmail: service.saloon.user.email,
            ownerPhone: service.saloon.user.phoneNumber,
        },
    }));
});
const getCustomerByIdFromDb = (customerId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonOwner.findUnique({
        where: {
            id: customerId,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'customer not found');
    }
    return result;
});
const updateCustomerIntoDb = (userId, customerId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonOwner.update({
        where: {
            id: customerId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'customerId, not updated');
    }
    return result;
});
const deleteCustomerItemFromDb = (userId, customerId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.saloonOwner.delete({
        where: {
            id: customerId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'customerId, not deleted');
    }
    return deletedItem;
});
exports.customerService = {
    createCustomerIntoDb,
    getAllSaloonListFromDb,
    getSaloonAllServicesListFromDb,
    getCustomerByIdFromDb,
    updateCustomerIntoDb,
    deleteCustomerItemFromDb,
};
