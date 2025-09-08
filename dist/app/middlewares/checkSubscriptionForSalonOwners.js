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
const AppError_1 = __importDefault(require("../errors/AppError"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const client_1 = require("@prisma/client");
const checkSubscriptionForSalonOwners = () => {
    return (req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            const role = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
            if (!userId) {
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'User not found in request');
            }
            // ✅ Only enforce subscription if role is SALOON_OWNER
            if (role === client_1.UserRoleEnum.SALOON_OWNER) {
                const user = yield prisma_1.default.user.findUnique({
                    where: { id: userId },
                    select: {
                        isSubscribed: true,
                        subscriptionEnd: true,
                        subscriptionPlan: true,
                    },
                });
                if (!user) {
                    throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'User not found');
                }
                const now = new Date();
                // Case 1: Free Plan → always allowed
                if (user.subscriptionPlan === client_1.SubscriptionPlanStatus.FREE) {
                    // Saloons with Free plan can not proceed if they are not subscribed
                    if (!user.isSubscribed) {
                        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You are on the Free plan. Please subscribe to a paid plan to access this feature.');
                    }
                }
                // Case 2: Paid Plan → must be active
                if (!user.isSubscribed ||
                    !user.subscriptionEnd ||
                    now > user.subscriptionEnd) {
                    throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Your subscription has expired. Please renew to continue.');
                }
                // Attach subscription details to req.user for downstream use
                req.user.isSubscribed = user.isSubscribed;
                req.user.subscriptionEnd = user.subscriptionEnd;
                req.user.subscriptionPlan = user.subscriptionPlan;
            }
            // ✅ Allow all other roles (CUSTOMER, BARBER, ADMIN, etc.)
            return next();
        }
        catch (err) {
            next(err);
        }
    });
};
exports.default = checkSubscriptionForSalonOwners;
