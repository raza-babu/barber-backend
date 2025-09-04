"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEnumQuery = exports.buildNumericRangeQuery = exports.buildCompleteQuery = exports.combineQueries = exports.buildDateRangeQuery = exports.buildFilterQuery = exports.buildSearchQuery = void 0;
const buildSearchQuery = (options) => {
    const { searchTerm, searchFields } = options;
    if (!searchTerm || !searchFields || searchFields.length === 0) {
        return {};
    }
    return {
        OR: searchFields.map((field) => ({
            [field]: {
                contains: searchTerm,
                mode: 'insensitive',
            },
        })),
    };
};
exports.buildSearchQuery = buildSearchQuery;
const buildFilterQuery = (filters) => {
    const whereClause = {};
    Object.keys(filters).forEach((key) => {
        const value = filters[key];
        if (value !== undefined && value !== null && value !== '') {
            // Handle array filters (for multiple selections)
            if (Array.isArray(value) && value.length > 0) {
                whereClause[key] = {
                    in: value,
                };
            }
            // Handle boolean filters
            else if (typeof value === 'boolean') {
                whereClause[key] = value;
            }
            // Handle string/number filters
            else {
                whereClause[key] = value;
            }
        }
    });
    return whereClause;
};
exports.buildFilterQuery = buildFilterQuery;
const buildDateRangeQuery = (options) => {
    const { startDate, endDate, dateField = 'createdAt' } = options;
    if (!startDate && !endDate) {
        return {};
    }
    const dateQuery = {};
    if (startDate) {
        dateQuery.gte = new Date(startDate);
    }
    if (endDate) {
        dateQuery.lte = new Date(endDate);
    }
    return {
        [dateField]: dateQuery,
    };
};
exports.buildDateRangeQuery = buildDateRangeQuery;
const combineQueries = (...queries) => {
    const combinedQuery = {};
    queries.forEach((query) => {
        if (query && Object.keys(query).length > 0) {
            Object.assign(combinedQuery, query);
        }
    });
    return combinedQuery;
};
exports.combineQueries = combineQueries;
const buildCompleteQuery = (searchOptions, filterOptions, dateRangeOptions) => {
    const searchQuery = searchOptions ? (0, exports.buildSearchQuery)(searchOptions) : {};
    const filterQuery = filterOptions ? (0, exports.buildFilterQuery)(filterOptions) : {};
    const dateQuery = dateRangeOptions ? (0, exports.buildDateRangeQuery)(dateRangeOptions) : {};
    const combinedFilters = (0, exports.combineQueries)(filterQuery, dateQuery);
    if (Object.keys(searchQuery).length > 0 && Object.keys(combinedFilters).length > 0) {
        return {
            AND: [searchQuery, combinedFilters],
        };
    }
    return (0, exports.combineQueries)(searchQuery, combinedFilters);
};
exports.buildCompleteQuery = buildCompleteQuery;
// Utility for handling numeric range filters
const buildNumericRangeQuery = (field, min, max) => {
    if (min === undefined && max === undefined) {
        return {};
    }
    const rangeQuery = {};
    if (min !== undefined) {
        rangeQuery.gte = min;
    }
    if (max !== undefined) {
        rangeQuery.lte = max;
    }
    return {
        [field]: rangeQuery,
    };
};
exports.buildNumericRangeQuery = buildNumericRangeQuery;
// Utility for handling enum filters
const buildEnumQuery = (field, values) => {
    if (!values || values.length === 0) {
        return {};
    }
    return {
        [field]: {
            in: values,
        },
    };
};
exports.buildEnumQuery = buildEnumQuery;
