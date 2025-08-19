"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.adminAccessFunctionService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const bcrypt = __importStar(require("bcrypt"));
const pagination_1 = require("../../utils/pagination");
const searchFilter_1 = require("../../utils/searchFilter");
const createAdminAccessFunctionIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // 1. Create User
        const newUser = yield tx.user.create({
            data: {
                fullName: data.fullName,
                email: data.email,
                password: yield bcrypt.hash(data.password, 12),
                role: data.role,
                image: data.image,
                phoneNumber: data.phone,
                status: client_1.UserStatus.ACTIVE,
                isProfileComplete: true,
            },
        });
        if (!newUser) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'User not created');
        }
        // 2. Create Admin
        const newAdmin = yield tx.admin.create({
            data: {
                userId: newUser.id,
                isSuperAdmin: data.role === client_1.UserRoleEnum.SUPER_ADMIN ? true : false,
            },
        });
        if (!newAdmin) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Admin not created');
        }
        // 3. Create Admin Access Functions
        if (data.function && data.function.length > 0) {
            const result = yield tx.adminAccessFunction.createMany({
                data: data.function.map(func => ({
                    userId: userId,
                    adminId: newAdmin.id,
                    accessFunctionId: func,
                })),
            });
            if (!result) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to create access functions');
            }
            return {
                user: {
                    fullName: newUser.fullName,
                    email: newUser.email,
                    image: newUser.image,
                    role: newUser.role,
                },
                admin: newAdmin,
                accessFunctions: result,
            };
        }
    }));
});
const getAdminAccessFunctionListFromDb = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    // Build where clause for admin filtering
    const adminWhereClauseFromQuery = (0, searchFilter_1.buildCompleteQuery)({
        searchTerm: options.searchTerm,
        searchFields: ['user.fullName', 'user.email'],
    }, {
        'user.role': options.role,
        isSuperAdmin: options.isSuperAdmin === true ? true :
            options.isSuperAdmin === false ? false : undefined,
    }, {
        startDate: options.startDate,
        endDate: options.endDate,
        dateField: 'user.createdAt',
    });
    // Handle nested user search separately due to Prisma limitations
    let userWhereClause = {};
    if (options.searchTerm) {
        userWhereClause = {
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
            ],
        };
    }
    // Add role filter
    if (options.role) {
        userWhereClause.role = options.role;
    }
    // Add date range filter for user
    if (options.startDate || options.endDate) {
        userWhereClause.createdAt = {};
        if (options.startDate) {
            userWhereClause.createdAt.gte = new Date(options.startDate);
        }
        if (options.endDate) {
            userWhereClause.createdAt.lte = new Date(options.endDate);
        }
    }
    // Build admin where clause
    let adminWhereClause = {};
    if (options.isSuperAdmin !== undefined) {
        adminWhereClause.isSuperAdmin = options.isSuperAdmin === 'true';
    }
    // Add user filter to admin where clause
    if (Object.keys(userWhereClause).length > 0) {
        adminWhereClause.user = userWhereClause;
    }
    const [admins, total] = yield Promise.all([
        prisma_1.default.admin.findMany({
            where: adminWhereClause,
            skip,
            take: limit,
            orderBy: {
                user: {
                    [sortBy === 'fullName' || sortBy === 'email' ? sortBy : 'createdAt']: sortOrder,
                },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        image: true,
                        role: true,
                        createdAt: true,
                    },
                },
                AdminAccessFunction: {
                    include: {
                        accessFunction: {
                            select: {
                                id: true,
                                function: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma_1.default.admin.count({
            where: adminWhereClause,
        }),
    ]);
    // Transform the data
    const transformedData = admins.map(admin => {
        var _a;
        return ({
            adminId: admin.userId,
            information: admin.user,
            role: admin.user.role,
            isSuperAdmin: admin.isSuperAdmin,
            accesses: ((_a = admin.AdminAccessFunction) === null || _a === void 0 ? void 0 : _a.map(item => {
                var _a, _b;
                return ({
                    accessFunctionId: (_a = item.accessFunction) === null || _a === void 0 ? void 0 : _a.id,
                    function: (_b = item.accessFunction) === null || _b === void 0 ? void 0 : _b.function,
                    adminAccessFunctionId: item.id,
                });
            })) || [],
        });
    });
    return (0, pagination_1.formatPaginationResponse)(transformedData, total, page, limit);
});
const getAdminAccessFunctionByIdFromDb = (adminId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const result = yield prisma_1.default.admin.findUnique({
        where: {
            userId: adminId,
        },
        include: {
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    image: true,
                    role: true,
                },
            },
            AdminAccessFunction: {
                include: {
                    accessFunction: {
                        select: {
                            id: true,
                            function: true,
                        },
                    },
                },
            },
        },
    });
    // Flatten access functions for response
    let accesses = [];
    if (result === null || result === void 0 ? void 0 : result.AdminAccessFunction) {
        accesses = result.AdminAccessFunction.map(item => {
            var _a, _b;
            return ({
                accessFunctionId: (_a = item.accessFunction) === null || _a === void 0 ? void 0 : _a.id,
                function: (_b = item.accessFunction) === null || _b === void 0 ? void 0 : _b.function,
                adminAccessFunctionId: item.id,
            });
        });
    }
    return {
        adminId: result === null || result === void 0 ? void 0 : result.userId,
        information: (result === null || result === void 0 ? void 0 : result.user) || null,
        role: ((_a = result === null || result === void 0 ? void 0 : result.user) === null || _a === void 0 ? void 0 : _a.role) || null,
        isSuperAdmin: result === null || result === void 0 ? void 0 : result.isSuperAdmin,
        accesses: accesses,
    };
});
const updateAdminAccessFunctionIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // 1. Delete existing accesses for this admin
        yield tx.adminAccessFunction.deleteMany({
            where: {
                adminId: data.adminId,
                userId: userId,
            },
        });
        // 2. Add new accesses
        if (!Array.isArray(data.function)) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'accessFunctionIds must be a non-empty array');
        }
        const created = yield tx.adminAccessFunction.createMany({
            data: data.function.map(func => ({
                userId: userId,
                adminId: data.adminId,
                accessFunctionId: func,
            })),
        });
        if (!created) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'adminAccessFunctionId, not updated');
        }
        // 3. Return the new list of accesses
        const updatedAccesses = yield tx.adminAccessFunction.findMany({
            where: {
                adminId: data.adminId,
                userId: userId,
            },
            include: {
                accessFunction: {
                    select: {
                        function: true,
                    },
                },
            },
        });
        return updatedAccesses;
    }));
});
const deleteAdminAccessFunctionItemFromDb = (userId, adminAccessFunctionId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.adminAccessFunction.delete({
        where: {
            id: adminAccessFunctionId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'adminAccessFunctionId, not deleted');
    }
    return deletedItem;
});
exports.adminAccessFunctionService = {
    createAdminAccessFunctionIntoDb,
    getAdminAccessFunctionListFromDb,
    getAdminAccessFunctionByIdFromDb,
    updateAdminAccessFunctionIntoDb,
    deleteAdminAccessFunctionItemFromDb,
};
