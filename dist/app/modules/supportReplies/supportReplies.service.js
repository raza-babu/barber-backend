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
                user: {
                    select: {
                        id: true,
                        phoneNumber: true,
                        address: true,
                    },
                },
            },
        }),
        prisma_1.default.support.count({
            where: whereClause,
        }),
    ]);
    // Flatten the user object into each report
    const flattenedReports = reports.map(report => ({
        reportId: report.id,
        userId: report.userId,
        userName: report.userName,
        message: report.message,
        status: report.status,
        type: report.type,
        userPhoneNumber: report.user.phoneNumber,
        userAddress: report.user.address,
    }));
    return (0, pagination_1.formatPaginationResponse)(flattenedReports, total, page, limit);
});
const getSupportRepliesListFromDb = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    const whereClause = (0, searchFilter_1.buildCompleteQuery)({
        searchTerm: options.searchTerm,
        searchFields: ['userName', 'message'],
    }, {
        status: options.status,
        type: client_1.SupportType.CUSTOMER_QUESTION,
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
                user: {
                    select: {
                        id: true,
                        phoneNumber: true,
                        address: true,
                    },
                },
            },
        }),
        prisma_1.default.support.count({
            where: whereClause,
        }),
    ]);
    const flattenFormattedReplies = supportReplies.map(reply => ({
        supportId: reply.id,
        userId: reply.userId,
        userName: reply.userName,
        message: reply.message,
        status: reply.status,
        type: reply.type,
        userPhoneNumber: reply.user.phoneNumber,
        userAddress: reply.user.address,
    }));
    return (0, pagination_1.formatPaginationResponse)(flattenFormattedReplies, total, page, limit);
});
const updateSupportByIdFromDb = (userId, supportRepliesId, data) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield tx.support.update({
            where: {
                id: supportRepliesId,
            },
            data: {
                status: client_1.SupportStatus.CLOSED,
            },
        });
        if (!result) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Support item is not found');
        }
        const userData = yield tx.user.findUnique({
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
                        type: true,
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
          <h2 style="margin: 0; font-size: 24px;">Support from Barber Time</h2>
        </td>
      </tr>
      <tr>
        <td style="padding: 20px;">
          <p style="font-size: 16px; margin: 0;">Hello <strong>${userData.fullName}</strong>,</p>
          <p style="font-size: 16px;">Your message: ${result.message}</p>
          <div style="text-align: center; margin: 20px 0;">
            <p style="font-size: 18px;" >${data.message}</p>
          </div>
          <p style="font-size: 14px; color: #555;">If you did not request this support, please ignore this email. No further action is needed.</p>
          <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
        </td>
      </tr>
      <tr>
        <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Team. All rights reserved.</p>
        </td>
      </tr>
      </table>
    </div>
      `);
        const existingReply = yield tx.reply.findFirst({
            where: {
                supportId: supportRepliesId,
                type: client_1.ReplyType.SUPPORT,
            },
        });
        if (existingReply) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Reply already exists');
        }
        const updateReplies = yield tx.reply.create({
            data: {
                userId: userId,
                supportId: supportRepliesId,
                status: client_1.ReplyStatus.CLOSED,
                type: client_1.ReplyType.SUPPORT,
                message: data.message,
            },
        });
        if (!updateReplies) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Reply not created');
        }
        return updateReplies;
    }));
});
const updateSupportRepliesIntoDb = (userId, supportRepliesId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield prisma_1.default.user.findUnique({
        where: {
            id: data.userId
        },
    });
    if (!userData) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const supportData = yield tx.support.findUnique({
            where: {
                id: supportRepliesId,
                userId: data.userId,
            },
            select: {
                id: true,
                message: true,
                userId: true,
                userName: true,
                type: true,
            },
        });
        if (!supportData) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Support item not found');
        }
        yield (0, emailSender_1.default)('Barbers Time - Support', userData.email, `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <table width="100%" style="border-collapse: collapse;">
      <tr>
        <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">Support From Barber Time</h2>
        </td>
      </tr>
      <tr>
        <td style="padding: 20px;">
          <p style="font-size: 16px; margin: 0;">Hello <strong>${userData.fullName}</strong>,</p>
          <p style="font-size: 16px;">${supportData.message}.</p>
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
        const result = yield tx.support.update({
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
        const reportUpdate = yield tx.reply.create({
            data: {
                userId: userId,
                reportId: supportRepliesId,
                message: data.message,
                type: client_1.ReplyType.REPORT,
                status: client_1.ReplyStatus.CLOSED,
            },
        });
        if (!reportUpdate) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Reply not created');
        }
        return reportUpdate;
    }));
});
const getSpecificRepliesByIdFromDb = (userId, supportRepliesId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.reply.findFirst({
        where: {
            reportId: supportRepliesId,
        },
        select: {
            id: true,
            userId: true,
            supportId: true,
            message: true,
            status: true,
            type: true,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Support item not found');
    }
    return {
        id: result.id,
        supportId: result.supportId,
        userId: result.userId,
        message: result.message,
        status: result.status,
        type: result.type,
    };
});
const getSpecificSupportReplyByIdFromDb = (userId, supportRepliesId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.reply.findFirst({
        where: {
            supportId: supportRepliesId,
            // userId: userId,
        },
        select: {
            id: true,
            userId: true,
            message: true,
            status: true,
            type: true,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Support item not found');
    }
    return {
        id: result.id,
        userId: result.userId,
        message: result.message,
        status: result.status,
        type: result.type,
    };
});
const deleteSupportRepliesItemFromDb = (userId, supportRepliesId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.support.delete({
        where: {
            id: supportRepliesId,
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
    updateSupportByIdFromDb,
    updateSupportRepliesIntoDb,
    deleteSupportRepliesItemFromDb,
    getSpecificRepliesByIdFromDb,
    getSupportRepliesReportsFromDb,
    getSpecificSupportReplyByIdFromDb,
};
