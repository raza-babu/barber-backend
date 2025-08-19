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
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../../config"));
const AppError_1 = __importDefault(require("../errors/AppError"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const verifyToken_1 = require("../utils/verifyToken");
const client_1 = require("@prisma/client");
const auth = (...roles) => {
    return (req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const token = req.headers.authorization;
            if (!token) {
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'You are not authorized!');
            }
            const verifyUserToken = (0, verifyToken_1.verifyToken)(token, config_1.default.jwt.access_secret);
            // Check token purpose
            if (!verifyUserToken.purpose || verifyUserToken.purpose !== 'access') {
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Invalid token purpose!');
            }
            // Check user exists with admin relations
            const user = yield prisma_1.default.user.findUniqueOrThrow({
                where: { id: verifyUserToken.id },
                include: {
                    Admin: {
                        include: {
                            AdminAccessFunction: {
                                include: {
                                    accessFunction: {
                                        select: {
                                            function: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (!user) {
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'You are not authorized!');
            }
            // Initialize permissions and super admin status
            let isSuperAdmin = false;
            let permissions = [];
            // Handle admin-specific checks
            if (user.role === client_1.UserRoleEnum.ADMIN || user.role === client_1.UserRoleEnum.SUPER_ADMIN) {
                if (!user.Admin || user.Admin.length === 0) {
                    throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Admin profile not found');
                }
                // Get first admin record (assuming one-to-one relationship)
                const admin = user.Admin[0];
                isSuperAdmin = admin.isSuperAdmin || false;
                permissions = admin.AdminAccessFunction.map(af => af.accessFunction.function);
                // Skip permission check for super admin
                if (!isSuperAdmin) {
                    const requiredPermission = req.permission;
                    if (requiredPermission && !permissions.includes(requiredPermission)) {
                        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Insufficient permissions');
                    }
                }
            }
            // Role-based access check
            if (roles.length && !roles.includes(user.role)) {
                throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Forbidden!');
            }
            // Attach user and permissions to request
            req.user = Object.assign(Object.assign({}, verifyUserToken), { isSuperAdmin,
                permissions });
            next();
        }
        catch (error) {
            next(error);
        }
    });
};
exports.default = auth;
