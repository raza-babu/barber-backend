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
exports.supportRepliesService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const emailSender_1 = __importDefault(require("../../utils/emailSender"));
const client_1 = require("@prisma/client");
const pagination_1 = require("../../utils/pagination");
const searchFilter_1 = require("../../utils/searchFilter");
const createSupportRepliesIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield prisma_1.default.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            fullName: true,
        },
    });
    if (!user) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    const result = yield prisma_1.default.support.create({
        data: Object.assign(Object.assign({}, data), { userId: userId, userName: user === null || user === void 0 ? void 0 : user.fullName }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Support Item is not created');
    }
    return result;
});
const getSupportRepliesReportsFromDb = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    const whereClause = (0, searchFilter_1.buildCompleteQuery)({
        searchTerm: options.searchTerm,
        searchFields: ['userName', 'message'],
    }, {
        type: client_1.SupportType.CUSTOMER_COMPLAINT,
        status: options.status,
    }, {
        startDate: options.startDate,
        endDate: options.endDate,
        dateField: 'createdAt',
    });
    const [reports, total] = yield Promise.all([
        prisma_1.default.support.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            select: {
                id: true,
                userId: true,
                userName: true,
                message: true,
                status: true,
                type: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
        prisma_1.default.support.count({
            where: whereClause,
        }),
    ]);
    return (0, pagination_1.formatPaginationResponse)(reports, total, page, limit);
});
const getSupportRepliesListFromDb = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    const whereClause = (0, searchFilter_1.buildCompleteQuery)({
        searchTerm: options.searchTerm,
        searchFields: ['userName', 'message'],
    }, {
        status: options.status,
        type: options.type,
    }, {
        startDate: options.startDate,
        endDate: options.endDate,
        dateField: 'createdAt',
    });
    const [supportReplies, total] = yield Promise.all([
        prisma_1.default.support.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            select: {
                id: true,
                userId: true,
                userName: true,
                message: true,
                status: true,
                type: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
        prisma_1.default.support.count({
            where: whereClause,
        }),
    ]);
    return (0, pagination_1.formatPaginationResponse)(supportReplies, total, page, limit);
});
const getSupportRepliesByIdFromDb = (supportRepliesId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.support.update({
        where: {
            id: supportRepliesId,
        },
        data: {
            status: client_1.SupportStatus.IN_PROGRESS,
        },
    });
    if (!result) {
        return { message: 'Support item is not found' };
    }
    return result;
});
const updateSupportRepliesIntoDb = (userId, supportRepliesId, data) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userData = yield prisma_1.default.user.findUnique({
        where: {
            id: data.userId,
        },
        include: {
            Support: {
                where: {
                    id: supportRepliesId,
                    userId: data.userId,
                },
                select: {
                    message: true,
                },
            },
        },
    });
    if (!userData) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    yield (0, emailSender_1.default)('Barbers Time - Support', userData.email, `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">${(_b = (_a = userData.Support[0]) === null || _a === void 0 ? void 0 : _a.message) !== null && _b !== void 0 ? _b : ''}</h2>
      </td>
    </tr>
    <tr>

      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${userData.fullName}</strong>,</p>
        <p style="font-size: 16px;">Hope your doing well.</p>
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 18px;" >${data.message}</p>
        </div>
        <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
        <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Time Team. All rights reserved.</p>
      </td>
    </tr>
    </table>
  </div>

      `);
    const result = yield prisma_1.default.support.update({
        where: {
            id: supportRepliesId,
        },
        data: {
            status: client_1.SupportStatus.CLOSED,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Support Item is not updated');
    }
    return result;
});
const deleteSupportRepliesItemFromDb = (userId, supportRepliesId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.support.delete({
        where: {
            id: supportRepliesId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'supportRepliesId is not deleted');
    }
    return deletedItem;
});
exports.supportRepliesService = {
    createSupportRepliesIntoDb,
    getSupportRepliesListFromDb,
    getSupportRepliesByIdFromDb,
    updateSupportRepliesIntoDb,
    deleteSupportRepliesItemFromDb,
    getSupportRepliesReportsFromDb,
};
