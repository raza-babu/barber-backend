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
exports.jobPostService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const pagination_1 = require("../../utils/pagination");
const searchFilter_1 = require("../../utils/searchFilter");
const createJobPostIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const shopDetails = yield prisma_1.default.user.findUnique({
        where: {
            id: userId,
        },
        include: {
            SaloonOwner: {
                select: {
                    userId: true,
                    shopLogo: true,
                    shopName: true,
                },
            },
        },
    });
    if (!shopDetails) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Shop not found');
    }
    const result = yield prisma_1.default.jobPost.create({
        data: Object.assign(Object.assign({}, data), { userId: userId, saloonOwnerId: (_a = shopDetails.SaloonOwner[0]) === null || _a === void 0 ? void 0 : _a.userId, startDate: new Date(data.startDate), endDate: new Date(data.endDate), datePosted: new Date(data.datePosted), shopName: (_b = shopDetails.SaloonOwner[0]) === null || _b === void 0 ? void 0 : _b.shopName, shopLogo: (_c = shopDetails.SaloonOwner[0]) === null || _c === void 0 ? void 0 : _c.shopLogo }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'jobPost not created');
    }
    return result;
});
const getJobPostListFromDb = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    // Build search query
    const searchQuery = options.searchTerm ? {
        OR: [
            {
            // title: {
            //   contains: options.searchTerm,
            //   mode: 'insensitive' as const,
            // },
            },
            {
                description: {
                    contains: options.searchTerm,
                    mode: 'insensitive',
                },
            },
            {
                shopName: {
                    contains: options.searchTerm,
                    mode: 'insensitive',
                },
            },
            {
                location: {
                    contains: options.searchTerm,
                    mode: 'insensitive',
                },
            },
        ],
    } : {};
    // Build filter query
    const filterQuery = {
        isActive: options.isActive !== undefined ? options.isActive === 'true' : true,
    };
    // Add experience filter if provided
    if (options.experienceRequired !== undefined) {
        filterQuery.experienceRequired = {
            gte: Number(options.experienceRequired),
        };
    }
    // Build salary range filter
    const salaryRangeQuery = (0, searchFilter_1.buildNumericRangeQuery)('salary', options.salaryMin ? Number(options.salaryMin) : undefined, options.salaryMax ? Number(options.salaryMax) : undefined);
    // Build date range query
    const dateRangeQuery = options.startDate || options.endDate ? {
        datePosted: Object.assign(Object.assign({}, (options.startDate && { gte: new Date(options.startDate) })), (options.endDate && { lte: new Date(options.endDate) })),
    } : {};
    // Combine all queries
    const whereClause = Object.assign(Object.assign(Object.assign(Object.assign({}, filterQuery), salaryRangeQuery), dateRangeQuery), (Object.keys(searchQuery).length > 0 && searchQuery));
    const [jobPosts, total] = yield Promise.all([
        prisma_1.default.jobPost.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            select: {
                id: true,
                // title: true,
                description: true,
                salary: true,
                // location: true,
                // experienceRequired: true,
                isActive: true,
                datePosted: true,
                startDate: true,
                endDate: true,
                shopName: true,
                shopLogo: true,
                saloonOwnerId: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
        prisma_1.default.jobPost.count({
            where: whereClause,
        }),
    ]);
    return (0, pagination_1.formatPaginationResponse)(jobPosts, total, page, limit);
});
const getJobPostByIdFromDb = (userId, jobPostId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.jobPost.findUnique({
        where: {
            id: jobPostId,
            userId: userId,
            isActive: true,
        },
    });
    if (!result) {
        return { message: "No job post found" };
    }
    return result;
});
const updateJobPostIntoDb = (userId, jobPostId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const updateData = Object.assign(Object.assign({}, data), { userId: userId });
    if (data.startDate) {
        updateData.startDate = new Date(data.startDate);
    }
    if (data.endDate) {
        updateData.endDate = new Date(data.endDate);
    }
    const result = yield prisma_1.default.jobPost.update({
        where: {
            id: jobPostId,
            userId: userId,
        },
        data: updateData,
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'jobPostId, not updated');
    }
    return result;
});
const toggleJobPostActiveIntoDb = (userId, jobPostId) => __awaiter(void 0, void 0, void 0, function* () {
    const jobPost = yield prisma_1.default.jobPost.findUnique({
        where: {
            id: jobPostId,
            userId: userId,
        },
    });
    if (!jobPost) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'JobPost not found');
    }
    const updatedJobPost = yield prisma_1.default.jobPost.update({
        where: {
            id: jobPostId,
            userId: userId,
        },
        data: {
            isActive: !jobPost.isActive,
        },
    });
    if (!updatedJobPost) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'JobPost active status not toggled');
    }
    return updatedJobPost;
});
const deleteJobPostItemFromDb = (userId, jobPostId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.jobPost.delete({
        where: {
            id: jobPostId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'jobPostId, not deleted');
    }
    return deletedItem;
});
exports.jobPostService = {
    createJobPostIntoDb,
    getJobPostListFromDb,
    getJobPostByIdFromDb,
    updateJobPostIntoDb,
    toggleJobPostActiveIntoDb,
    deleteJobPostItemFromDb,
};
