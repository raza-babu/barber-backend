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
exports.reviewService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createReviewIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const BookingStatusCheck = yield tx.booking.findUnique({
            where: {
                id: data.bookingId,
                userId: userId,
                status: client_1.BookingStatus.COMPLETED,
            },
        });
        if (!BookingStatusCheck) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking not found or not completed');
        }
        const existingReview = yield tx.review.findFirst({
            where: {
                userId: userId,
                saloonOwnerId: data.saloonOwnerId,
                barberId: data.barberId,
                bookingId: data.bookingId,
            },
        });
        if (existingReview) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Review already exists for this booking');
        }
        const result = yield tx.review.create({
            data: Object.assign(Object.assign({}, data), { userId: userId }),
        });
        if (!result) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'review not created');
        }
        const findExistingReview = yield tx.review.findMany({
            where: {
                saloonOwnerId: data.saloonOwnerId,
                barberId: data.barberId,
            },
            select: {
                rating: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        const saloonReviewCount = findExistingReview.length;
        const saloonAvgRating = saloonReviewCount === 0
            ? 0
            : findExistingReview.reduce((acc, review) => acc + review.rating, 0) /
                saloonReviewCount;
        const updateSaloonOwner = yield tx.saloonOwner.update({
            where: {
                userId: data.saloonOwnerId,
            },
            data: {
                ratingCount: {
                    increment: 1,
                },
                avgRating: {
                    set: saloonAvgRating,
                },
            },
        });
        if (!updateSaloonOwner) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon owner not updated');
        }
        const barberReviewCount = findExistingReview.length;
        const barberAvgRating = barberReviewCount === 0
            ? 0
            : findExistingReview.reduce((acc, review) => acc + review.rating, 0) /
                barberReviewCount;
        const updateBarber = yield tx.barber.update({
            where: {
                userId: data.barberId,
                saloonOwnerId: data.saloonOwnerId,
            },
            data: {
                ratingCount: {
                    increment: 1,
                },
                avgRating: {
                    set: barberAvgRating,
                },
            },
        });
        if (!updateBarber) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber not updated');
        }
        return result;
    }));
});
const getReviewListForSaloonFromDb = (userId, saloonOwnerId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.review.findMany({
        where: {
            saloonOwnerId,
        },
        select: {
            id: true,
            userId: true,
            barberId: true,
            saloonOwnerId: true,
            bookingId: true,
            rating: true,
            comment: true,
            createdAt: true,
            saloonOwner: {
                select: {
                    userId: true,
                    shopName: true,
                    shopAddress: true,
                    shopLogo: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    if (result.length === 0) {
        return [];
    }
    return result.map(review => {
        var _a, _b, _c;
        return ({
            id: review.id,
            customerId: review.userId,
            rating: review.rating,
            comment: review.comment,
            barberId: review.barberId,
            saloonOwnerId: review.saloonOwnerId,
            saloonName: ((_a = review.saloonOwner) === null || _a === void 0 ? void 0 : _a.shopName) || 'Unknown Saloon',
            saloonAddress: ((_b = review.saloonOwner) === null || _b === void 0 ? void 0 : _b.shopAddress) || 'Unknown Address',
            saloonLogo: ((_c = review.saloonOwner) === null || _c === void 0 ? void 0 : _c.shopLogo) || null,
            bookingId: review.bookingId,
            createdAt: review.createdAt,
        });
    });
});
const getNotProvidedReviewsForSaloonFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.booking.findMany({
        where: {
            userId: userId,
            status: client_1.BookingStatus.COMPLETED,
            Review: {
                none: {},
            },
        },
        select: {
            id: true,
            userId: true,
            barberId: true,
            saloonOwnerId: true,
            date: true,
            appointmentAt: true,
        },
        orderBy: {
            date: 'desc',
        },
    });
    const saloonsNotReviewed = yield Promise.all(result.map((booking) => __awaiter(void 0, void 0, void 0, function* () {
        const saloons = yield prisma_1.default.saloonOwner.findUnique({
            where: {
                userId: booking.saloonOwnerId,
            },
            select: {
                id: true,
                userId: true,
                shopName: true,
                shopAddress: true,
                shopImages: true,
                isVerified: true,
                shopLogo: true,
                shopVideo: true,
                latitude: true,
                longitude: true,
                ratingCount: true,
                avgRating: true,
                FavoriteShop: {
                    where: {
                        userId: booking.userId,
                    },
                    select: {
                        id: true,
                    },
                },
            },
        });
        return {
            id: saloons === null || saloons === void 0 ? void 0 : saloons.id,
            userId: saloons === null || saloons === void 0 ? void 0 : saloons.userId,
            bookingId: booking.id,
            barberId: booking.barberId,
            saloonOwnerId: booking.saloonOwnerId,
            // date: booking.date,
            // appointmentAt: booking.appointmentAt,
            saloonName: (saloons === null || saloons === void 0 ? void 0 : saloons.shopName) || 'Unknown Saloon',
            saloonAddress: (saloons === null || saloons === void 0 ? void 0 : saloons.shopAddress) || 'Unknown Address',
            saloonLogo: (saloons === null || saloons === void 0 ? void 0 : saloons.shopLogo) || null,
            saloonImages: (saloons === null || saloons === void 0 ? void 0 : saloons.shopImages) || [],
            saloonVideo: (saloons === null || saloons === void 0 ? void 0 : saloons.shopVideo) || null,
            latitude: (saloons === null || saloons === void 0 ? void 0 : saloons.latitude) || null,
            longitude: (saloons === null || saloons === void 0 ? void 0 : saloons.longitude) || null,
            ratingCount: (saloons === null || saloons === void 0 ? void 0 : saloons.ratingCount) || 0,
            avgRating: (saloons === null || saloons === void 0 ? void 0 : saloons.avgRating) || 0,
            isFavorite: (saloons === null || saloons === void 0 ? void 0 : saloons.FavoriteShop.length) !== 0,
        };
    })));
    return saloonsNotReviewed;
});
const getReviewListForBarberFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.review.findMany({
        where: {
            OR: [{ barberId: userId }, { saloonOwnerId: userId }],
        },
        select: {
            id: true,
            barberId: true,
            saloonOwnerId: true,
            bookingId: true,
            userId: true,
            rating: true,
            comment: true,
            images: true,
            createdAt: true,
            saloonOwner: {
                select: {
                    userId: true,
                    shopName: true,
                    shopAddress: true,
                    shopLogo: true,
                },
            },
            barber: {
                select: {
                    userId: true,
                    user: {
                        select: {
                            fullName: true,
                            email: true,
                            image: true,
                        },
                    },
                },
            },
            booking: {
                select: {
                    appointmentAt: true,
                    date: true,
                    user: {
                        select: {
                            fullName: true,
                            image: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    if (result.length === 0) {
        return [];
    }
    return result.map(review => {
        var _a, _b, _c, _d;
        return ({
            id: review.id,
            customerId: review.userId,
            rating: review.rating,
            comment: review.comment,
            barberId: userId,
            saloonOwnerId: ((_a = review.saloonOwner) === null || _a === void 0 ? void 0 : _a.userId) || null,
            saloonName: ((_b = review.saloonOwner) === null || _b === void 0 ? void 0 : _b.shopName) || 'Unknown Saloon',
            saloonAddress: ((_c = review.saloonOwner) === null || _c === void 0 ? void 0 : _c.shopAddress) || 'Unknown Address',
            saloonLogo: ((_d = review.saloonOwner) === null || _d === void 0 ? void 0 : _d.shopLogo) || null,
            bookingId: review.bookingId,
            createdAt: review.createdAt,
        });
    });
});
const getReviewByIdFromDb = (userId, reviewId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.review.findUnique({
        where: {
            id: reviewId,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'review not found');
    }
    return result;
});
const updateReviewIntoDb = (userId, reviewId, data) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield tx.review.update({
            where: {
                id: reviewId,
                userId: userId,
            },
            data: Object.assign({}, data),
        });
        if (!result) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'reviewId, not updated');
        }
        const findExistingReview = yield tx.review.findMany({
            where: {
                saloonOwnerId: result.saloonOwnerId,
                barberId: result.barberId,
            },
            select: {
                rating: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        const saloonReviewCount = findExistingReview.length;
        const saloonAvgRating = saloonReviewCount === 0
            ? 0
            : findExistingReview.reduce((acc, review) => acc + review.rating, 0) /
                saloonReviewCount;
        const updateSaloonOwner = yield tx.saloonOwner.update({
            where: {
                userId: result.saloonOwnerId,
            },
            data: {
                avgRating: {
                    set: saloonAvgRating,
                },
            },
        });
        if (!updateSaloonOwner) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon owner not updated');
        }
        const barberReviewCount = findExistingReview.length;
        const barberAvgRating = barberReviewCount === 0
            ? 0
            : findExistingReview.reduce((acc, review) => acc + review.rating, 0) /
                barberReviewCount;
        const updateBarber = yield tx.barber.update({
            where: {
                userId: result.barberId,
                saloonOwnerId: result.saloonOwnerId,
            },
            data: {
                avgRating: {
                    set: barberAvgRating,
                },
            },
        });
        if (!updateBarber) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber not updated');
        }
        return result;
    }));
});
const deleteReviewItemFromDb = (userId, reviewId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const deletedItem = yield tx.review.delete({
            where: {
                id: reviewId,
                userId: userId,
            },
        });
        if (!deletedItem) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'reviewId, not deleted');
        }
        const findExistingReview = yield tx.review.findMany({
            where: {
                saloonOwnerId: deletedItem.saloonOwnerId,
                barberId: deletedItem.barberId,
            },
            select: {
                rating: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        const saloonReviewCount = findExistingReview.length;
        const saloonAvgRating = saloonReviewCount === 0
            ? 0
            : findExistingReview.reduce((acc, review) => acc + review.rating, 0) /
                saloonReviewCount;
        const updateSaloonOwner = yield tx.saloonOwner.update({
            where: {
                userId: deletedItem.saloonOwnerId,
            },
            data: {
                ratingCount: {
                    decrement: 1,
                },
                avgRating: {
                    set: saloonAvgRating,
                },
            },
        });
        if (!updateSaloonOwner) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon owner not updated');
        }
        const barberReviewCount = findExistingReview.length;
        const barberAvgRating = barberReviewCount === 0
            ? 0
            : findExistingReview.reduce((acc, review) => acc + review.rating, 0) /
                barberReviewCount;
        const updateBarber = yield tx.barber.update({
            where: {
                userId: deletedItem.barberId,
                saloonOwnerId: deletedItem.saloonOwnerId,
            },
            data: {
                ratingCount: {
                    decrement: 1,
                },
                avgRating: {
                    set: barberAvgRating,
                },
            },
        });
        if (!updateBarber) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber not updated');
        }
        return deletedItem;
    }));
});
exports.reviewService = {
    createReviewIntoDb,
    getReviewListForSaloonFromDb,
    getReviewListForBarberFromDb,
    getNotProvidedReviewsForSaloonFromDb,
    getReviewByIdFromDb,
    updateReviewIntoDb,
    deleteReviewItemFromDb,
};
