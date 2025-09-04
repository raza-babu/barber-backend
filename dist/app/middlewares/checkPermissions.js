"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPermissions = void 0;
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../errors/AppError"));
const checkPermissions = (...requiredPermissions) => {
    return (req, res, next) => {
        // Skip check for super admins
        if (req.user.isSuperAdmin) {
            return next();
        }
        // Check if user has all required permissions
        const hasAllPermissions = requiredPermissions.every(permission => req.user.permissions.includes(permission));
        console.log(`User Permissions: ${req.user.permissions}`);
        console.log(`Required Permissions: ${requiredPermissions}`);
        if (!hasAllPermissions) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, `You need ${requiredPermissions.join(', ')} permission(s) to access this resource`);
        }
        next();
    };
};
exports.checkPermissions = checkPermissions;
