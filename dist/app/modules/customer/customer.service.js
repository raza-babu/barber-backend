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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const client_1 = require("@prisma/client");
const createCustomerIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonOwner.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'customer not created');
    }
    return result;
});
const getAllSaloonListFromDb = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const { searchTerm = '', page = 1, limit = 10, sortBy = 'name', minRating, } = query;
    const skip = (page - 1) * limit;
    // Build where clause
    const where = {
        isVerified: true,
    };
    if (searchTerm) {
        where.OR = [
            { shopName: { contains: searchTerm, mode: 'insensitive' } },
            { shopAddress: { contains: searchTerm, mode: 'insensitive' } },
        ];
    }
    if (minRating) {
        where.avgRating = { gte: minRating };
    }
    // Build orderBy clause
    let orderBy = {};
    switch (sortBy) {
        case 'rating':
            orderBy = { avgRating: 'desc' };
            break;
        case 'newest':
            orderBy = { createdAt: 'desc' };
            break;
        default:
            orderBy = { shopName: 'asc' };
    }
    // Get total count
    const total = yield prisma_1.default.saloonOwner.count({ where });
    // Get paginated results
    const result = yield prisma_1.default.saloonOwner.findMany({
        where,
        select: {
            id: true,
            userId: true,
            shopName: true,
            shopAddress: true,
            shopImages: true,
            isVerified: true,
            shopLogo: true,
            shopVideo: true,
            latitude: true,
            longitude: true,
            ratingCount: true,
            avgRating: true,
            Booking: {
                where: {
                    bookingType: client_1.BookingType.QUEUE,
                    status: {
                        in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.PENDING],
                    },
                },
            },
        },
        orderBy,
        skip,
        take: limit,
    });
    const saloons = result.map((_a) => {
        var { Booking } = _a, rest = __rest(_a, ["Booking"]);
        return (Object.assign(Object.assign({}, rest), { distance: 0, queue: Array.isArray(Booking) ? Booking.length : 0 }));
    });
    return {
        data: saloons,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
});
// All saloons near get within a radius
const getMyNearestSaloonListFromDb = (latitude_1, longitude_1, ...args_1) => __awaiter(void 0, [latitude_1, longitude_1, ...args_1], void 0, function* (latitude, longitude, query = {}) {
    const { radius = 50, searchTerm = '', page = 1, limit = 10, minRating } = query;
    const radiusInKm = radius;
    // Build where clause
    const where = {
        isVerified: true,
        latitude: { not: null },
        longitude: { not: null },
    };
    if (searchTerm) {
        where.OR = [
            { shopName: { contains: searchTerm, mode: 'insensitive' } },
            { shopAddress: { contains: searchTerm, mode: 'insensitive' } },
        ];
    }
    if (minRating) {
        where.avgRating = { gte: minRating };
    }
    // Get all verified saloons
    const allSaloons = yield prisma_1.default.saloonOwner.findMany({
        where,
        select: {
            id: true,
            userId: true,
            shopName: true,
            shopAddress: true,
            shopImages: true,
            shopLogo: true,
            shopVideo: true,
            latitude: true,
            longitude: true,
            ratingCount: true,
            avgRating: true,
            Booking: {
                where: {
                    bookingType: client_1.BookingType.QUEUE,
                    status: {
                        in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.PENDING],
                    },
                },
            },
        },
    });
    // Haversine formula to calculate distance
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in kilometers
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    };
    // Filter and sort saloons by distance
    const nearbySaloons = allSaloons
        .map(saloon => {
        const distance = calculateDistance(latitude, longitude, Number(saloon.latitude), Number(saloon.longitude));
        const { Booking } = saloon, rest = __rest(saloon, ["Booking"]);
        return Object.assign(Object.assign({}, rest), { distance: Math.round(distance * 100) / 100, queue: Array.isArray(Booking) ? Booking.length : 0 });
    })
        .filter(saloon => saloon.distance <= radiusInKm)
        .sort((a, b) => a.distance - b.distance);
    // Apply pagination
    const total = nearbySaloons.length;
    const skip = (page - 1) * limit;
    const paginatedSaloons = nearbySaloons.slice(skip, skip + limit);
    return {
        data: paginatedSaloons,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
});
const getTopRatedSaloonsFromDb = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const { searchTerm = '', page = 1, limit = 10, minRating } = query;
    // Build where clause
    const where = {
        isVerified: true,
    };
    if (searchTerm) {
        where.OR = [
            { shopName: { contains: searchTerm, mode: 'insensitive' } },
            { shopAddress: { contains: searchTerm, mode: 'insensitive' } },
        ];
    }
    if (minRating) {
        where.avgRating = { gte: minRating };
    }
    // Get total count
    const total = yield prisma_1.default.saloonOwner.count({ where });
    // Get results
    const result = yield prisma_1.default.saloonOwner.findMany({
        where,
        select: {
            id: true,
            userId: true,
            shopName: true,
            shopAddress: true,
            shopImages: true,
            shopLogo: true,
            shopVideo: true,
            latitude: true,
            longitude: true,
            ratingCount: true,
            avgRating: true,
            Review: {
                select: {
                    rating: true,
                },
            },
            Booking: {
                where: {
                    bookingType: client_1.BookingType.QUEUE,
                    status: {
                        in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.PENDING],
                    },
                },
            },
        },
    });
    // Normalize output to the requested format and sort by avgRating desc
    const saloonsWithAvgRatings = result
        .map(saloon => {
        var _a, _b, _c;
        const reviews = Array.isArray(saloon.Review)
            ? saloon.Review
            : [];
        const ratingsArray = reviews
            .map((r) => {
            const val = r && typeof r.rating !== 'undefined' ? r.rating : null;
            return typeof val === 'number' ? val : Number(val);
        })
            .filter((n) => !isNaN(n));
        const computedAvg = ratingsArray.length > 0
            ? ratingsArray.reduce((s, v) => s + v, 0) /
                ratingsArray.length
            : typeof saloon.avgRating === 'number'
                ? saloon.avgRating
                : 0;
        const ratingCount = typeof saloon.ratingCount === 'number'
            ? saloon.ratingCount
            : ratingsArray.length;
        return {
            id: saloon.id,
            userId: saloon.userId,
            shopName: saloon.shopName,
            shopAddress: saloon.shopAddress,
            shopImages: (_a = saloon.shopImages) !== null && _a !== void 0 ? _a : [],
            shopLogo: (_b = saloon.shopLogo) !== null && _b !== void 0 ? _b : null,
            shopVideo: (_c = saloon.shopVideo) !== null && _c !== void 0 ? _c : [],
            latitude: saloon.latitude !== null && typeof saloon.latitude !== 'undefined'
                ? Number(saloon.latitude)
                : null,
            longitude: saloon.longitude !== null && typeof saloon.longitude !== 'undefined'
                ? Number(saloon.longitude)
                : null,
            ratingCount: ratingCount,
            avgRating: Math.round(computedAvg * 100) / 100,
            distance: 0,
            queue: saloon.Booking.length,
        };
    })
        .sort((a, b) => b.avgRating - a.avgRating);
    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedSaloons = saloonsWithAvgRatings.slice(skip, skip + limit);
    return {
        data: paginatedSaloons,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
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
    getTopRatedSaloonsFromDb,
    getSaloonAllServicesListFromDb,
    getCustomerByIdFromDb,
    updateCustomerIntoDb,
    deleteCustomerItemFromDb,
};
