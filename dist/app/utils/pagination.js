"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaginationQuery = exports.formatPaginationResponse = exports.calculatePagination = void 0;
const calculatePagination = (options) => {
    const page = Number(options.page || 1);
    const limit = Number(options.limit || 10);
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    return {
        page,
        limit,
        skip,
        sortBy,
        sortOrder,
    };
};
exports.calculatePagination = calculatePagination;
const formatPaginationResponse = (data, total, page, limit) => {
    const totalPages = Math.ceil(total / limit);
    return {
        data,
        meta: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
    };
};
exports.formatPaginationResponse = formatPaginationResponse;
const getPaginationQuery = (sortBy, sortOrder) => {
    return {
        orderBy: {
            [sortBy]: sortOrder,
        },
    };
};
exports.getPaginationQuery = getPaginationQuery;
