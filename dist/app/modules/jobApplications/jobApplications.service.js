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
exports.jobApplicationsService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const pagination_1 = require("../../utils/pagination");
const searchFilter_1 = require("../../utils/searchFilter");
const createJobApplicationsIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const saloonDetails = yield prisma_1.default.jobPost.findUnique({
        where: {
            id: data.jobPostId,
        },
        select: {
            saloonOwnerId: true,
        },
    });
    if (!saloonDetails) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Saloon not found');
    }
    // Check if barber exists and is active
    const barber = yield prisma_1.default.barber.findUnique({
        where: {
            userId: userId,
        },
        include: {
            user: true,
        },
    });
    if (!barber || barber.user.status !== client_1.UserStatus.ACTIVE) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber professional profile not found or inactive');
    }
    const result = yield prisma_1.default.jobApplication.create({
        data: Object.assign(Object.assign({}, data), { userId: userId, saloonOwnerId: saloonDetails.saloonOwnerId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'jobApplications not created');
    }
    return result;
});
const getJobApplicationsListFromDb = (userId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    // Build base where clause for user access
    const baseWhereClause = {
        OR: [{ userId: userId }, { saloonOwnerId: userId }],
    };
    // Build search and filter queries
    const searchAndFilterQuery = (0, searchFilter_1.buildCompleteQuery)({
        searchTerm: options.searchTerm,
        searchFields: ['barber.user.fullName', 'barber.user.email', 'jobPost.description'],
    }, {
        status: options.status,
        jobPostId: options.jobPostId,
    }, {
        startDate: options.startDate,
        endDate: options.endDate,
        dateField: 'createdAt',
    });
    // Since Prisma doesn't handle nested search well, we'll handle it manually
    let whereClause = Object.assign({}, baseWhereClause);
    // Add simple filters
    if (options.status) {
        whereClause.status = options.status;
    }
    if (options.jobPostId) {
        whereClause.jobPostId = options.jobPostId;
    }
    // Add date range filter
    if (options.startDate || options.endDate) {
        whereClause.createdAt = {};
        if (options.startDate) {
            whereClause.createdAt.gte = new Date(options.startDate);
        }
        if (options.endDate) {
            whereClause.createdAt.lte = new Date(options.endDate);
        }
    }
    // Handle search across related fields
    if (options.searchTerm) {
        whereClause.OR = [
            ...whereClause.OR,
            {
                barber: {
                    user: {
                        fullName: {
                            contains: options.searchTerm,
                            mode: 'insensitive',
                        },
                    },
                },
            },
            {
                barber: {
                    user: {
                        email: {
                            contains: options.searchTerm,
                            mode: 'insensitive',
                        },
                    },
                },
            },
            {
                jobPost: {
                    description: {
                        contains: options.searchTerm,
                        mode: 'insensitive',
                    },
                },
            },
        ];
    }
    const [jobApplications, total] = yield Promise.all([
        prisma_1.default.jobApplication.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            include: {
                barber: {
                    select: {
                        ratingCount: true,
                        avgRating: true,
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                phoneNumber: true,
                                image: true,
                                address: true,
                            },
                        },
                    },
                },
                jobPost: {
                    select: {
                        id: true,
                        // title: true,
                        description: true,
                        hourlyRate: true,
                        startDate: true,
                        endDate: true,
                        datePosted: true,
                        shopName: true,
                        saloonOwner: {
                            select: {
                                shopAddress: true,
                                ratingCount: true,
                                avgRating: true,
                            },
                        }
                    },
                },
            },
        }),
        prisma_1.default.jobApplication.count({
            where: whereClause,
        }),
    ]);
    // Transform the data
    const transformedData = jobApplications.map(app => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        return ({
            id: app.id,
            status: app.status,
            createdAt: app.createdAt,
            updatedAt: app.updatedAt,
            barber: {
                id: (_a = app.barber) === null || _a === void 0 ? void 0 : _a.user.id,
                fullName: (_b = app.barber) === null || _b === void 0 ? void 0 : _b.user.fullName,
                email: (_c = app.barber) === null || _c === void 0 ? void 0 : _c.user.email,
                phoneNumber: (_d = app.barber) === null || _d === void 0 ? void 0 : _d.user.phoneNumber,
                image: (_e = app.barber) === null || _e === void 0 ? void 0 : _e.user.image,
                address: (_f = app.barber) === null || _f === void 0 ? void 0 : _f.user.address,
                ratingCount: (_g = app.barber) === null || _g === void 0 ? void 0 : _g.ratingCount,
                avgRating: (_h = app.barber) === null || _h === void 0 ? void 0 : _h.avgRating,
            },
            jobPost: app.jobPost ? {
                id: app.jobPost.id,
                description: app.jobPost.description,
                hourlyRate: app.jobPost.hourlyRate,
                startDate: app.jobPost.startDate,
                endDate: app.jobPost.endDate,
                datePosted: app.jobPost.datePosted,
                shopName: app.jobPost.shopName,
                shopAddress: (_j = app.jobPost.saloonOwner) === null || _j === void 0 ? void 0 : _j.shopAddress,
                saloonOwnerRatingCount: (_k = app.jobPost.saloonOwner) === null || _k === void 0 ? void 0 : _k.ratingCount,
                saloonOwnerAvgRating: (_l = app.jobPost.saloonOwner) === null || _l === void 0 ? void 0 : _l.avgRating,
            } : null,
        });
    });
    return (0, pagination_1.formatPaginationResponse)(transformedData, total, page, limit);
});
const getJobApplicationsByIdFromDb = (userId, jobApplicationsId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const result = yield prisma_1.default.jobApplication.findUnique({
        where: {
            id: jobApplicationsId,
            OR: [{ userId: userId }, { saloonOwnerId: userId }],
        },
        include: {
            barber: {
                select: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            phoneNumber: true,
                            image: true,
                        },
                    },
                },
            },
            jobPost: {
                select: {
                    id: true,
                    // title: true,
                    description: true,
                    hourlyRate: true,
                    startDate: true,
                    endDate: true,
                    datePosted: true,
                    shopName: true,
                },
            },
        },
    });
    if (!result) {
        return { message: 'Job application not found' };
    }
    return {
        id: result.id,
        status: result.status,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        barber: (_a = result.barber) === null || _a === void 0 ? void 0 : _a.user,
        jobPost: result.jobPost,
    };
});
const getHiredBarbersListFromDb = (userId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    // Build where clause
    let whereClause = {
        userId: userId,
    };
    // Add date range filter
    if (options.startDate || options.endDate) {
        whereClause.createdAt = {};
        if (options.startDate) {
            whereClause.createdAt.gte = new Date(options.startDate);
        }
        if (options.endDate) {
            whereClause.createdAt.lte = new Date(options.endDate);
        }
    }
    // Handle search across barber fields
    if (options.searchTerm) {
        whereClause.barber = {
            user: {
                OR: [
                    {
                        fullName: {
                            contains: options.searchTerm,
                            mode: 'insensitive',
                        },
                    },
                    {
                        email: {
                            contains: options.searchTerm,
                            mode: 'insensitive',
                        },
                    },
                    {
                        phoneNumber: {
                            contains: options.searchTerm,
                            mode: 'insensitive',
                        },
                    },
                ],
            },
        };
    }
    const [hiredBarbers, total] = yield Promise.all([
        prisma_1.default.hiredBarber.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            include: {
                barber: {
                    select: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                phoneNumber: true,
                                image: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma_1.default.hiredBarber.count({
            where: whereClause,
        }),
    ]);
    // Transform the data
    const transformedData = hiredBarbers.map(hired => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return ({
            // id: hired.id,
            hourlyRate: hired.hourlyRate,
            startDate: hired.startDate,
            createdAt: hired.createdAt,
            updatedAt: hired.updatedAt,
            barberId: (_b = (_a = hired.barber) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id,
            barberFullName: (_d = (_c = hired.barber) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.fullName,
            barberEmail: (_f = (_e = hired.barber) === null || _e === void 0 ? void 0 : _e.user) === null || _f === void 0 ? void 0 : _f.email,
            barberPhoneNumber: (_h = (_g = hired.barber) === null || _g === void 0 ? void 0 : _g.user) === null || _h === void 0 ? void 0 : _h.phoneNumber,
            barberImage: (_k = (_j = hired.barber) === null || _j === void 0 ? void 0 : _j.user) === null || _k === void 0 ? void 0 : _k.image,
        });
    });
    return (0, pagination_1.formatPaginationResponse)(transformedData, total, page, limit);
});
const updateJobApplicationsIntoDb = (userId, jobApplicationsId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const existingApplication = yield prisma_1.default.jobApplication.findUnique({
        where: {
            id: jobApplicationsId,
            saloonOwnerId: userId,
            status: client_1.JobApplicationStatus.PENDING,
        },
    });
    if (!existingApplication) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Only applications with status other than PENDING can be updated');
    }
    const result = yield prisma_1.default.jobApplication.update({
        where: {
            id: jobApplicationsId,
            saloonOwnerId: userId,
            status: client_1.JobApplicationStatus.PENDING,
        },
        data: Object.assign({}, data),
        include: {
            jobPost: {
                select: {
                    id: true,
                    description: true,
                    saloonOwnerId: true,
                    hourlyRate: true,
                    startDate: true,
                    endDate: true,
                    datePosted: true,
                },
            },
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'jobApplicationsId, not updated');
    }
    if (result.status === client_1.JobApplicationStatus.COMPLETED) {
        const newHiredBarber = yield prisma_1.default.hiredBarber.create({
            data: {
                userId: result.saloonOwnerId,
                barberId: result.userId,
                hourlyRate: result.jobPost.hourlyRate,
                startDate: result.jobPost.startDate,
            },
        });
        if (!newHiredBarber) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to create hired barber record');
        }
        const updateBarber = yield prisma_1.default.barber.update({
            where: {
                userId: newHiredBarber.barberId,
            },
            data: {
                saloonOwnerId: result.saloonOwnerId,
            },
        });
        if (!updateBarber) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to update barber status');
        }
    }
    return result;
});
const deleteJobApplicationsItemFromDb = (userId, jobApplicationsId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.jobApplication.delete({
        where: {
            id: jobApplicationsId,
            OR: [{ userId: userId }, { saloonOwnerId: userId }],
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'jobApplicationsId, not deleted');
    }
    return deletedItem;
});
const getMyJobApplicationsListFromDb = (userId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    // Build base where clause for user access
    const baseWhereClause = {
        userId: userId,
    };
    // Build search and filter queries
    const searchAndFilterQuery = (0, searchFilter_1.buildCompleteQuery)({
        searchTerm: options.searchTerm,
        searchFields: ['barber.user.fullName', 'barber.user.email', 'jobPost.description', 'jobPost.status'],
    }, {
        status: options.status,
        jobPostId: options.jobPostId,
    }, {
        startDate: options.startDate,
        endDate: options.endDate,
        dateField: 'createdAt',
    });
    // Since Prisma doesn't handle nested search well, we'll handle it manually
    let whereClause = Object.assign(Object.assign({}, baseWhereClause), searchAndFilterQuery);
    // Add simple filters
    if (options.status) {
        whereClause.status = options.status;
    }
    if (options.jobPostId) {
        whereClause.jobPostId = options.jobPostId;
    }
    // Add date range filter
    if (options.startDate || options.endDate) {
        whereClause.createdAt = {};
        if (options.startDate) {
            whereClause.createdAt.gte = new Date(options.startDate);
        }
        if (options.endDate) {
            whereClause.createdAt.lte = new Date(options.endDate);
        }
    }
    // Handle search across related fields
    if (options.searchTerm) {
        whereClause.OR = [
            ...whereClause.OR,
            {
                barber: {
                    user: {
                        fullName: {
                            contains: options.searchTerm,
                            mode: 'insensitive',
                        },
                    },
                },
            },
            {
                barber: {
                    user: {
                        email: {
                            contains: options.searchTerm,
                            mode: 'insensitive',
                        },
                    },
                },
            },
            {
                jobPost: {
                    description: {
                        contains: options.searchTerm,
                        mode: 'insensitive',
                    },
                },
            },
        ];
    }
    const [jobApplications, total] = yield Promise.all([
        prisma_1.default.jobApplication.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            include: {
                barber: {
                    select: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                phoneNumber: true,
                                image: true,
                            },
                        },
                    },
                },
                jobPost: {
                    select: {
                        id: true,
                        // title: true,
                        description: true,
                        hourlyRate: true,
                        startDate: true,
                        endDate: true,
                        datePosted: true,
                        shopName: true,
                        shopAddress: true,
                    },
                },
            },
        }),
        prisma_1.default.jobApplication.count({
            where: whereClause,
        }),
    ]);
    // Transform the data
    const transformedData = jobApplications.map(app => {
        var _a;
        return ({
            id: app.id,
            status: app.status,
            createdAt: app.createdAt,
            updatedAt: app.updatedAt,
            barber: (_a = app.barber) === null || _a === void 0 ? void 0 : _a.user,
            jobPost: app.jobPost,
        });
    });
    return (0, pagination_1.formatPaginationResponse)(transformedData, total, page, limit);
});
const getJobApplicationsByIdForBarberFromDb = (userId, jobApplicationsId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const result = yield prisma_1.default.jobApplication.findFirst({
        where: {
            id: jobApplicationsId,
            userId: userId,
        },
        include: {
            barber: {
                select: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            phoneNumber: true,
                            image: true,
                        },
                    },
                },
            },
            jobPost: {
                select: {
                    id: true,
                    // title: true,
                    description: true,
                    hourlyRate: true,
                    startDate: true,
                    endDate: true,
                    datePosted: true,
                    shopName: true,
                    shopAddress: true,
                },
            },
        },
    });
    if (!result) {
        return { message: 'Job application not found' };
    }
    return {
        id: result.id,
        status: result.status,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        barber: (_a = result.barber) === null || _a === void 0 ? void 0 : _a.user,
        jobPost: result.jobPost,
    };
});
exports.jobApplicationsService = {
    createJobApplicationsIntoDb,
    getJobApplicationsListFromDb,
    getJobApplicationsByIdFromDb,
    getHiredBarbersListFromDb,
    updateJobApplicationsIntoDb,
    deleteJobApplicationsItemFromDb,
    getMyJobApplicationsListFromDb,
    getJobApplicationsByIdForBarberFromDb,
};
