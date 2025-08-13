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
exports.adminService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const pagination_1 = require("../../utils/pagination");
const searchFilter_1 = require("../../utils/searchFilter");
const getSaloonFromDb = (userId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    const whereClause = (0, searchFilter_1.buildCompleteQuery)({
        searchTerm: options.searchTerm,
        searchFields: ['fullName', 'email', 'phoneNumber'],
    }, {
        role: client_1.UserRoleEnum.SALOON_OWNER,
        status: options.status || client_1.UserStatus.ACTIVE,
    }, {
        startDate: options.startDate,
        endDate: options.endDate,
        dateField: 'createdAt',
    });
    // Handle SaloonOwner specific filters
    if (options.isVerified !== undefined) {
        whereClause.SaloonOwner = {
            isVerified: options.isVerified === true,
        };
    }
    const [saloons, total] = yield Promise.all([
        prisma_1.default.user.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                status: true,
                createdAt: true,
                SaloonOwner: {
                    select: {
                        userId: true,
                        isVerified: true,
                        shopAddress: true,
                        shopName: true,
                        registrationNumber: true,
                        shopLogo: true,
                        shopImages: true,
                        shopVideo: true,
                    },
                },
            },
        }),
        prisma_1.default.user.count({
            where: whereClause,
        }),
    ]);
    return (0, pagination_1.formatPaginationResponse)(saloons, total, page, limit);
});
const blockSaloonByIdIntoDb = (saloonOwnerId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { status } = data;
    const result = yield prisma_1.default.saloonOwner.update({
        where: {
            userId: saloonOwnerId,
        },
        data: {
            isVerified: status,
        },
        select: {
            userId: true,
            isVerified: true,
            shopAddress: true,
            shopName: true,
            registrationNumber: true,
            shopLogo: true,
            shopImages: true,
            shopVideo: true,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon not found or not updated');
    }
    return result;
});
const getBarbersListFromDb = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    const whereClause = (0, searchFilter_1.buildCompleteQuery)({
        searchTerm: options.searchTerm,
        searchFields: ['fullName', 'email', 'phoneNumber'],
    }, {
        role: client_1.UserRoleEnum.BARBER,
        status: options.status || client_1.UserStatus.ACTIVE,
    }, {
        startDate: options.startDate,
        endDate: options.endDate,
        dateField: 'createdAt',
    });
    // Handle Barber specific filters
    if (options.experienceYears !== undefined) {
        whereClause.Barber = {
            experienceYears: {
                gte: Number(options.experienceYears),
            },
        };
    }
    const [barbers, total] = yield Promise.all([
        prisma_1.default.user.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                status: true,
                createdAt: true,
                Barber: {
                    select: {
                        userId: true,
                        portfolio: true,
                        experienceYears: true,
                        skills: true,
                        bio: true,
                    },
                },
            },
        }),
        prisma_1.default.user.count({
            where: whereClause,
        }),
    ]);
    return (0, pagination_1.formatPaginationResponse)(barbers, total, page, limit);
});
const blockBarberByIdIntoDb = (userId, barberId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.user.update({
        where: {
            id: barberId,
            role: client_1.UserRoleEnum.BARBER,
        },
        data: {
            status: data.status === true ? client_1.UserStatus.BLOCKED : client_1.UserStatus.ACTIVE,
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            status: true,
            createdAt: true,
            Barber: {
                select: {
                    userId: true,
                    portfolio: true,
                    experienceYears: true,
                    skills: true,
                    bio: true,
                },
            },
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber not found or not updated');
    }
    return result;
});
const getCustomersListFromDb = (userId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    const whereClause = (0, searchFilter_1.buildCompleteQuery)({
        searchTerm: options.searchTerm,
        searchFields: ['fullName', 'email', 'phoneNumber'],
    }, {
        role: client_1.UserRoleEnum.CUSTOMER,
        status: options.status || client_1.UserStatus.ACTIVE,
    }, {
        startDate: options.startDate,
        endDate: options.endDate,
        dateField: 'createdAt',
    });
    const [customers, total] = yield Promise.all([
        prisma_1.default.user.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                image: true,
                status: true,
                createdAt: true,
            },
        }),
        prisma_1.default.user.count({
            where: whereClause,
        }),
    ]);
    return (0, pagination_1.formatPaginationResponse)(customers, total, page, limit);
});
const blockCustomerByIdIntoDb = (userId, customerId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.user.update({
        where: {
            id: customerId,
            role: client_1.UserRoleEnum.CUSTOMER,
        },
        data: {
            status: data.status === true ? client_1.UserStatus.BLOCKED : client_1.UserStatus.ACTIVE,
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            image: true,
            status: true,
            createdAt: true,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Customer not found or not updated');
    }
    return result;
});
const updateSaloonOwnerByIdIntoDb = (userId, saloonOwnerId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { status } = data;
    const saloonOwner = yield prisma_1.default.saloonOwner.update({
        where: {
            userId: saloonOwnerId,
        },
        data: {
            isVerified: status === true ? true : false,
        }
    });
    if (!saloonOwner) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon owner not found or not updated');
    }
    return saloonOwner;
});
const getAdminDashboardFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const saloonCount = yield prisma_1.default.saloonOwner.count({
        where: {
            isVerified: true,
        },
    });
    const barberCount = yield prisma_1.default.user.count({
        where: {
            role: client_1.UserRoleEnum.BARBER,
            status: client_1.UserStatus.ACTIVE,
        },
    });
    const customerCount = yield prisma_1.default.user.count({
        where: {
            role: client_1.UserRoleEnum.CUSTOMER,
            status: client_1.UserStatus.ACTIVE,
        },
    });
    const userGrowth = yield prisma_1.default.user.groupBy({
        by: ['createdAt', 'role'],
        _count: {
            id: true,
        },
        where: {
            role: {
                in: [client_1.UserRoleEnum.SALOON_OWNER, client_1.UserRoleEnum.BARBER, client_1.UserRoleEnum.CUSTOMER],
            },
            status: client_1.UserStatus.ACTIVE,
            createdAt: {
                gte: new Date(new Date().setMonth(new Date().getMonth() - 1)), // Last month
            },
        },
        orderBy: [
            { createdAt: 'asc' },
            { role: 'asc' },
        ],
    });
    return {
        saloonCount,
        barberCount,
        customerCount,
        userGrowth: userGrowth.map((item) => ({
            date: item.createdAt.toISOString().split('T')[0], // Format date to YYYY-MM-DD
            role: item.role,
            count: item._count.id,
        })),
    };
});
exports.adminService = {
    getSaloonFromDb,
    blockSaloonByIdIntoDb,
    getBarbersListFromDb,
    blockBarberByIdIntoDb,
    getCustomersListFromDb,
    blockCustomerByIdIntoDb,
    updateSaloonOwnerByIdIntoDb,
    getAdminDashboardFromDb,
};
