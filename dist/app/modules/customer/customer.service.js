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
// All saloons near get within a radius
const getMyNearestSaloonListFromDb = (latitude, longitude, radiusInKm) => __awaiter(void 0, void 0, void 0, function* () {
    const radiusInMeters = (radiusInKm || 10) * 1000; // Mongo uses meters
    const saloons = yield prisma_1.default.saloonOwner.aggregateRaw({
        pipeline: [
            {
                $geoNear: {
                    near: { type: 'Point', coordinates: [longitude, latitude] },
                    distanceField: 'distance',
                    maxDistance: radiusInMeters,
                    spherical: true,
                },
            },
            {
                $sort: { distance: 1 },
            },
        ],
    });
    return saloons;
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
            user: {
                select: {
                    SaloonOwner: {
                        select: {
                            userId: true,
                            shopName: true,
                            shopLogo: true,
                            shopAddress: true,
                        },
                    },
                },
            },
        },
    });
    if (result.length === 0) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'No services found');
    }
    return result.map(service => {
        var _a, _b;
        const saloon = (_b = (_a = service.user) === null || _a === void 0 ? void 0 : _a.SaloonOwner) === null || _b === void 0 ? void 0 : _b[0];
        return {
            id: service.id,
            name: service.serviceName,
            price: service.price,
            duration: service.duration,
            // isActive: service.isActive,
            saloonOwnerId: service.saloonOwnerId,
            saloon: saloon
                ? {
                    saloonId: saloon.userId,
                    shopName: saloon.shopName,
                    shopLogo: saloon.shopLogo,
                    shopAddress: saloon.shopAddress,
                }
                : null,
        };
    });
});
const getCustomerByIdFromDb = (userId, customerId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.user.findUnique({
        where: {
            id: customerId,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'customer not found');
    }
    return {
        isMe: result.id === userId,
        id: result.id,
        fullName: result.fullName,
        email: result.email,
        phoneNumber: result.phoneNumber,
        image: result.image,
        address: result.address,
    };
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
    getMyNearestSaloonListFromDb,
    getSaloonAllServicesListFromDb,
    getCustomerByIdFromDb,
    updateCustomerIntoDb,
    deleteCustomerItemFromDb,
};
