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
exports.serviceService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const pagination_1 = require("../../utils/pagination");
const searchFilter_1 = require("../../utils/searchFilter");
const createServiceIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.service.create({
        data: Object.assign(Object.assign({}, data), { saloonOwnerId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'service not created');
    }
    return result;
});
const getServiceListFromDb = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    // Build search query
    const searchQuery = options.searchTerm ? {
        OR: [
            {
                serviceName: {
                    contains: options.searchTerm,
                    mode: 'insensitive',
                },
            }, {},
            // {
            //   description: {
            //     contains: options.searchTerm,
            //     mode: 'insensitive' as const,
            //   },
            // },
            // {
            //   category: {
            //     contains: options.searchTerm,
            //     mode: 'insensitive' as const,
            //   },
            // },
        ],
    } : {};
    // Build filter query
    const filterQuery = {
        isActive: options.isActive !== undefined ? options.isActive === 'true' : true,
    };
    // Add saloon owner filter if provided
    if (options.saloonOwnerId) {
        filterQuery.saloonOwnerId = options.saloonOwnerId;
    }
    // Build price range filter
    const priceRangeQuery = (0, searchFilter_1.buildNumericRangeQuery)('price', options.priceMin ? Number(options.priceMin) : undefined, options.priceMax ? Number(options.priceMax) : undefined);
    // Build date range query
    const dateRangeQuery = options.startDate || options.endDate ? {
        createdAt: Object.assign(Object.assign({}, (options.startDate && { gte: new Date(options.startDate) })), (options.endDate && { lte: new Date(options.endDate) })),
    } : {};
    // Combine all queries
    const whereClause = Object.assign(Object.assign(Object.assign(Object.assign({}, filterQuery), priceRangeQuery), dateRangeQuery), (Object.keys(searchQuery).length > 0 && searchQuery));
    const [services, total] = yield Promise.all([
        prisma_1.default.service.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            include: {
                saloon: {
                    select: {
                        shopName: true,
                        shopLogo: true,
                        user: {
                            select: {
                                fullName: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma_1.default.service.count({
            where: whereClause,
        }),
    ]);
    // Transform the data to include saloon information
    const transformedServices = services.map(service => {
        var _a, _b, _c, _d, _e, _f;
        return ({
            id: service.id,
            name: service.serviceName,
            // description: service.description,
            price: service.price,
            duration: service.duration,
            // category: service.category,
            isActive: service.isActive,
            saloonOwnerId: service.saloonOwnerId,
            createdAt: service.createdAt,
            updatedAt: service.updatedAt,
            saloon: {
                shopName: (_a = service.saloon) === null || _a === void 0 ? void 0 : _a.shopName,
                shopLogo: (_b = service.saloon) === null || _b === void 0 ? void 0 : _b.shopLogo,
                ownerName: (_d = (_c = service.saloon) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.fullName,
                ownerEmail: (_f = (_e = service.saloon) === null || _e === void 0 ? void 0 : _e.user) === null || _f === void 0 ? void 0 : _f.email,
            },
        });
    });
    return (0, pagination_1.formatPaginationResponse)(transformedServices, total, page, limit);
});
const getServiceByIdFromDb = (serviceId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const result = yield prisma_1.default.service.findUnique({
        where: {
            id: serviceId,
            isActive: true,
        },
        include: {
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
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'service not found');
    }
    // Transform the data
    const transformedResult = {
        id: result.id,
        name: result.serviceName,
        // description: result.description,
        price: result.price,
        duration: result.duration,
        // category: result.category,
        isActive: result.isActive,
        saloonOwnerId: result.saloonOwnerId,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        saloon: {
            shopName: (_a = result.saloon) === null || _a === void 0 ? void 0 : _a.shopName,
            shopLogo: (_b = result.saloon) === null || _b === void 0 ? void 0 : _b.shopLogo,
            shopAddress: (_c = result.saloon) === null || _c === void 0 ? void 0 : _c.shopAddress,
            ownerName: (_e = (_d = result.saloon) === null || _d === void 0 ? void 0 : _d.user) === null || _e === void 0 ? void 0 : _e.fullName,
            ownerEmail: (_g = (_f = result.saloon) === null || _f === void 0 ? void 0 : _f.user) === null || _g === void 0 ? void 0 : _g.email,
            ownerPhone: (_j = (_h = result.saloon) === null || _h === void 0 ? void 0 : _h.user) === null || _j === void 0 ? void 0 : _j.phoneNumber,
        },
    };
    return transformedResult;
});
const updateServiceIntoDb = (userId, serviceId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.service.update({
        where: {
            id: serviceId,
            saloonOwnerId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'serviceId, not updated');
    }
    return result;
});
const toggleServiceActiveIntoDb = (userId, serviceId) => __awaiter(void 0, void 0, void 0, function* () {
    const service = yield prisma_1.default.service.findUnique({
        where: {
            id: serviceId,
            saloonOwnerId: userId,
        },
    });
    if (!service) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Service not found');
    }
    const updatedService = yield prisma_1.default.service.update({
        where: {
            id: serviceId,
            saloonOwnerId: userId,
        },
        data: {
            isActive: !service.isActive,
        },
    });
    return updatedService;
});
const deleteServiceItemFromDb = (userId, serviceId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.service.delete({
        where: {
            id: serviceId,
            saloonOwnerId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'serviceId, not deleted');
    }
    return deletedItem;
});
exports.serviceService = {
    createServiceIntoDb,
    getServiceListFromDb,
    getServiceByIdFromDb,
    updateServiceIntoDb,
    toggleServiceActiveIntoDb,
    deleteServiceItemFromDb,
};
