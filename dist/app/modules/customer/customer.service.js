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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const client_1 = require("@prisma/client");
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const createCustomerIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonOwner.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'customer not created');
    }
    return result;
});
const analyzeSaloonFromImageInDb = (userId, file) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    if (!file) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Image file is required');
    }
    const form = new form_data_1.default();
    // Handle both buffer (memoryStorage) and path (diskStorage)
    if (file.buffer && file.buffer.length > 0) {
        form.append('image', file.buffer, {
            filename: file.originalname || 'customer_image.jpg',
            contentType: file.mimetype || 'image/jpeg',
        });
    }
    else if (file.path) {
        const resolvedPath = path_1.default.isAbsolute(file.path)
            ? file.path
            : path_1.default.resolve(process.cwd(), file.path);
        if (!fs_1.default.existsSync(resolvedPath)) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, `Uploaded file not found: ${resolvedPath}`);
        }
        form.append('image', fs_1.default.createReadStream(resolvedPath), {
            filename: file.originalname || path_1.default.basename(resolvedPath),
            contentType: file.mimetype || 'image/jpeg',
        });
    }
    else {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Unsupported file format. Please upload a valid image.');
    }
    try {
        // Call the third-party AI API
        const url = 'https://reyai.dsrt321.online/analyze';
        const headers = form.getHeaders();
        console.log('=== AI Analysis Request ===');
        console.log('URL:', url);
        console.log('Headers:', headers);
        console.log('File info:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            hasBuffer: !!file.buffer,
            hasPath: !!file.path,
        });
        const response = yield axios_1.default.post(url, form, {
            headers,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 60000, // 60 seconds timeout
            validateStatus: (status) => status < 500, // Don't throw on 4xx errors
        });
        console.log('=== AI Analysis Response ===');
        console.log('Status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        // Handle non-success status codes
        if (response.status === 400) {
            const errorMessage = ((_a = response.data) === null || _a === void 0 ? void 0 : _a.message) || ((_b = response.data) === null || _b === void 0 ? void 0 : _b.error) || 'Bad request to AI service';
            console.error('400 Error details:', response.data);
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, `AI service error: ${errorMessage}`);
        }
        if (response.status === 401 || response.status === 403) {
            throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Authentication failed with AI service');
        }
        if (response.status === 404) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'AI analysis endpoint not found');
        }
        if (response.status >= 400) {
            throw new AppError_1.default(http_status_1.default.BAD_GATEWAY, `AI service returned error: ${response.status}`);
        }
        if (!response.data || !response.data.success) {
            throw new AppError_1.default(http_status_1.default.BAD_GATEWAY, 'AI analysis failed. Please try again.');
        }
        const { all_matches = [], best_match_per_barber = [], input_description, recommended_barber, } = response.data;
        // Get all unique barber codes
        const allBarberCodes = [
            ...new Set([
                ...all_matches.map((m) => m.barber_code),
                ...best_match_per_barber.map((m) => m.barber_code),
            ]),
        ].filter(Boolean);
        console.log('Extracted barber codes:', allBarberCodes);
        if (allBarberCodes.length === 0) {
            return {
                success: true,
                message: 'No matching barbers found for your style',
                input_description,
                all_matches: [],
                best_match_per_barber: [],
                recommended_barber: null,
                total_matches: 0,
            };
        }
        // Fetch barber details from database
        const barbers = yield prisma_1.default.barber.findMany({
            where: {
                userId: { in: allBarberCodes },
            },
            select: {
                id: true,
                userId: true,
                saloonOwnerId: true,
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        image: true,
                        phoneNumber: true,
                    },
                },
                saloonOwner: {
                    select: {
                        userId: true,
                        shopName: true,
                        shopAddress: true,
                        shopLogo: true,
                        shopImages: true,
                        latitude: true,
                        longitude: true,
                        avgRating: true,
                        ratingCount: true,
                    },
                },
            },
        });
        console.log(`Found ${barbers.length} barbers in database`);
        // Create a map of barber details by userId
        const barberDetailsMap = new Map(barbers.map(barber => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            return [
                barber.userId,
                {
                    barberId: barber.id,
                    barberUserId: barber.userId,
                    barberName: ((_a = barber.user) === null || _a === void 0 ? void 0 : _a.fullName) || null,
                    barberEmail: ((_b = barber.user) === null || _b === void 0 ? void 0 : _b.email) || null,
                    barberImage: ((_c = barber.user) === null || _c === void 0 ? void 0 : _c.image) || null,
                    barberPhone: ((_d = barber.user) === null || _d === void 0 ? void 0 : _d.phoneNumber) || null,
                    saloon: barber.saloonOwnerId
                        ? {
                            saloonOwnerId: ((_e = barber.saloonOwner) === null || _e === void 0 ? void 0 : _e.userId) || null,
                            shopName: ((_f = barber.saloonOwner) === null || _f === void 0 ? void 0 : _f.shopName) || null,
                            shopAddress: ((_g = barber.saloonOwner) === null || _g === void 0 ? void 0 : _g.shopAddress) || null,
                            shopLogo: ((_h = barber.saloonOwner) === null || _h === void 0 ? void 0 : _h.shopLogo) || null,
                            shopImages: ((_j = barber.saloonOwner) === null || _j === void 0 ? void 0 : _j.shopImages) || [],
                            latitude: ((_k = barber.saloonOwner) === null || _k === void 0 ? void 0 : _k.latitude)
                                ? Number(barber.saloonOwner.latitude)
                                : null,
                            longitude: ((_l = barber.saloonOwner) === null || _l === void 0 ? void 0 : _l.longitude)
                                ? Number(barber.saloonOwner.longitude)
                                : null,
                            avgRating: ((_m = barber.saloonOwner) === null || _m === void 0 ? void 0 : _m.avgRating)
                                ? Number(barber.saloonOwner.avgRating)
                                : 0,
                            ratingCount: ((_o = barber.saloonOwner) === null || _o === void 0 ? void 0 : _o.ratingCount) || 0,
                        }
                        : null,
                },
            ];
        }));
        // Enrich all_matches with barber details
        const enrichedAllMatches = all_matches
            .map((match) => {
            const barberDetails = barberDetailsMap.get(match.barber_code);
            if (!barberDetails) {
                console.log(`Barber ${match.barber_code} not found in database`);
                return null;
            }
            return Object.assign({ barber_code: match.barber_code, image: match.image, similarity: match.similarity || 0 }, barberDetails);
        })
            .filter(Boolean)
            .sort((a, b) => b.similarity - a.similarity);
        // Enrich best_match_per_barber with barber details
        const enrichedBestMatches = best_match_per_barber
            .map((match) => {
            const barberDetails = barberDetailsMap.get(match.barber_code);
            if (!barberDetails) {
                console.log(`Barber ${match.barber_code} not found in database`);
                return null;
            }
            return Object.assign({ barber_code: match.barber_code, image: match.image, similarity: match.similarity || 0 }, barberDetails);
        })
            .filter(Boolean)
            .sort((a, b) => b.similarity - a.similarity);
        // Get recommended barber details
        let recommendedBarberDetails = null;
        if (recommended_barber) {
            recommendedBarberDetails = barberDetailsMap.get(recommended_barber);
        }
        return {
            success: true,
            input_description: input_description || null,
            all_matches: enrichedAllMatches,
            best_match_per_barber: enrichedBestMatches,
            recommended_barber: recommendedBarberDetails
                ? Object.assign({ barber_code: recommended_barber }, recommendedBarberDetails) : null,
            total_matches: enrichedAllMatches.length,
        };
    }
    catch (err) {
        console.error('=== AI Analysis Error ===');
        console.error('Error type:', err.constructor.name);
        console.error('Error message:', err.message);
        if (err.response) {
            console.error('Response status:', err.response.status);
            console.error('Response data:', err.response.data);
            console.error('Response headers:', err.response.headers);
        }
        if (err.request) {
            console.error('Request was made but no response received');
        }
        if (err instanceof AppError_1.default) {
            throw err;
        }
        const message = ((_d = (_c = err === null || err === void 0 ? void 0 : err.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) ||
            ((_f = (_e = err === null || err === void 0 ? void 0 : err.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.error) ||
            (err === null || err === void 0 ? void 0 : err.message) ||
            'Failed to analyze image. Please try again.';
        throw new AppError_1.default(http_status_1.default.BAD_GATEWAY, message);
    }
});
const getAllSaloonListFromDb = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { searchTerm = '', page = 1, limit = 10, sortBy = 'name', minRating, } = query;
    const skip = (page - 1) * limit;
    // Build where clause
    const where = {
        isVerified: true,
    };
    if (searchTerm) {
        where.OR = [
            { shopName: { contains: searchTerm, mode: 'insensitive' } },
            { shopAddress: { contains: searchTerm, mode: 'insensitive' } },
        ];
    }
    if (minRating) {
        where.avgRating = { gte: minRating };
    }
    // Build orderBy clause
    let orderBy = {};
    switch (sortBy) {
        case 'rating':
            orderBy = { avgRating: 'desc' };
            break;
        case 'newest':
            orderBy = { createdAt: 'desc' };
            break;
        default:
            orderBy = { shopName: 'asc' };
    }
    // Get total count
    const total = yield prisma_1.default.saloonOwner.count({ where });
    // Get paginated results
    const result = yield prisma_1.default.saloonOwner.findMany({
        where,
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
            Booking: {
                where: {
                    bookingType: client_1.BookingType.QUEUE,
                    date: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                        lt: new Date(new Date().setHours(23, 59, 59, 999)),
                    },
                    status: {
                        in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.PENDING],
                    },
                },
            },
            FavoriteShop: { select: { id: true, userId: true } },
        },
        orderBy,
        skip,
        take: limit,
    });
    // check for favorite shop or not
    let isFavoriteShop = false;
    if (userId) {
        result.forEach(saloon => {
            isFavoriteShop = saloon.FavoriteShop.some(fav => fav.userId === userId);
            saloon.isFavorite = isFavoriteShop;
            delete saloon.FavoriteShop;
        });
    }
    else {
        result.forEach(saloon => {
            saloon.isFavorite = false;
            delete saloon.FavoriteShop;
        });
    }
    console.log(Array.isArray((_a = result[0]) === null || _a === void 0 ? void 0 : _a.Booking) ? (_b = result[0]) === null || _b === void 0 ? void 0 : _b.Booking.length : 0);
    const saloons = result.map((_a) => {
        var { Booking } = _a, rest = __rest(_a, ["Booking"]);
        return (Object.assign(Object.assign({}, rest), { distance: 0, queue: Array.isArray(Booking) ? Booking.length : 0 }));
    });
    return {
        data: saloons,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
});
// All saloons near get within a radius
const getMyNearestSaloonListFromDb = (userId_1, latitude_1, longitude_1, ...args_1) => __awaiter(void 0, [userId_1, latitude_1, longitude_1, ...args_1], void 0, function* (userId, latitude, longitude, query = {}) {
    const { radius = 50, searchTerm = '', page = 1, limit = 10, minRating, } = query;
    const radiusInKm = radius;
    // Build where clause
    const where = {
        isVerified: true,
        latitude: { not: null },
        longitude: { not: null },
    };
    if (searchTerm) {
        where.OR = [
            { shopName: { contains: searchTerm, mode: 'insensitive' } },
            { shopAddress: { contains: searchTerm, mode: 'insensitive' } },
        ];
    }
    if (minRating) {
        where.avgRating = { gte: minRating };
    }
    // Get all verified saloons
    const allSaloons = yield prisma_1.default.saloonOwner.findMany({
        where,
        select: {
            id: true,
            userId: true,
            shopName: true,
            shopAddress: true,
            shopImages: true,
            shopLogo: true,
            shopVideo: true,
            latitude: true,
            longitude: true,
            ratingCount: true,
            avgRating: true,
            Booking: {
                where: {
                    bookingType: client_1.BookingType.QUEUE,
                    date: new Date(),
                    status: {
                        in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.PENDING],
                    },
                },
            },
            FavoriteShop: { select: { id: true, userId: true } },
        },
    });
    // check for favorite shop or not
    let isFavoriteShop = false;
    if (userId) {
        allSaloons.forEach(saloon => {
            isFavoriteShop = saloon.FavoriteShop.some(fav => fav.userId === userId);
            saloon.isFavorite = isFavoriteShop;
            delete saloon.FavoriteShop;
        });
    }
    else {
        allSaloons.forEach(saloon => {
            saloon.isFavorite = false;
            delete saloon.FavoriteShop;
        });
    }
    // Haversine formula to calculate distance
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in kilometers
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    };
    // Filter and sort saloons by distance
    const nearbySaloons = allSaloons
        .map(saloon => {
        const distance = calculateDistance(latitude, longitude, Number(saloon.latitude), Number(saloon.longitude));
        const { Booking } = saloon, rest = __rest(saloon, ["Booking"]);
        return Object.assign(Object.assign({}, rest), { distance: Math.round(distance * 100) / 100, queue: Array.isArray(Booking) ? Booking.length : 0 });
    })
        .filter(saloon => saloon.distance <= radiusInKm)
        .sort((a, b) => a.distance - b.distance);
    // Apply pagination
    const total = nearbySaloons.length;
    const skip = (page - 1) * limit;
    const paginatedSaloons = nearbySaloons.slice(skip, skip + limit);
    return {
        data: paginatedSaloons,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
});
const getTopRatedSaloonsFromDb = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const { searchTerm = '', page = 1, limit = 10, minRating } = query;
    // Build where clause
    const where = {
        isVerified: true,
    };
    if (searchTerm) {
        where.OR = [
            { shopName: { contains: searchTerm, mode: 'insensitive' } },
            { shopAddress: { contains: searchTerm, mode: 'insensitive' } },
        ];
    }
    if (minRating) {
        where.avgRating = { gte: minRating };
    }
    // Get total count
    const total = yield prisma_1.default.saloonOwner.count({ where });
    // Get results
    const result = yield prisma_1.default.saloonOwner.findMany({
        where,
        select: {
            id: true,
            userId: true,
            shopName: true,
            shopAddress: true,
            shopImages: true,
            shopLogo: true,
            shopVideo: true,
            latitude: true,
            longitude: true,
            ratingCount: true,
            avgRating: true,
            Review: {
                select: {
                    rating: true,
                },
            },
            Booking: {
                where: {
                    bookingType: client_1.BookingType.QUEUE,
                    date: new Date(),
                    status: {
                        in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.PENDING],
                    },
                },
            },
            FavoriteShop: { select: { id: true, userId: true } },
        },
    });
    // check for favorite shop or not
    let isFavoriteShop = false;
    if (userId) {
        result.forEach(saloon => {
            isFavoriteShop = saloon.FavoriteShop.some(fav => fav.userId === userId);
            saloon.isFavorite = isFavoriteShop;
            delete saloon.FavoriteShop;
        });
    }
    else {
        result.forEach(saloon => {
            saloon.isFavorite = false;
            delete saloon.FavoriteShop;
        });
    }
    // Normalize output to the requested format and sort by avgRating desc
    const saloonsWithAvgRatings = result
        .map(saloon => {
        var _a, _b, _c;
        const reviews = Array.isArray(saloon.Review)
            ? saloon.Review
            : [];
        const ratingsArray = reviews
            .map((r) => {
            const val = r && typeof r.rating !== 'undefined' ? r.rating : null;
            return typeof val === 'number' ? val : Number(val);
        })
            .filter((n) => !isNaN(n));
        const computedAvg = ratingsArray.length > 0
            ? ratingsArray.reduce((s, v) => s + v, 0) /
                ratingsArray.length
            : typeof saloon.avgRating === 'number'
                ? saloon.avgRating
                : 0;
        const ratingCount = typeof saloon.ratingCount === 'number'
            ? saloon.ratingCount
            : ratingsArray.length;
        return {
            id: saloon.id,
            userId: saloon.userId,
            shopName: saloon.shopName,
            shopAddress: saloon.shopAddress,
            shopImages: (_a = saloon.shopImages) !== null && _a !== void 0 ? _a : [],
            shopLogo: (_b = saloon.shopLogo) !== null && _b !== void 0 ? _b : null,
            shopVideo: (_c = saloon.shopVideo) !== null && _c !== void 0 ? _c : [],
            latitude: saloon.latitude !== null && typeof saloon.latitude !== 'undefined'
                ? Number(saloon.latitude)
                : null,
            longitude: saloon.longitude !== null && typeof saloon.longitude !== 'undefined'
                ? Number(saloon.longitude)
                : null,
            ratingCount: ratingCount,
            avgRating: Math.round(computedAvg * 100) / 100,
            distance: 0,
            queue: saloon.Booking.length,
            isFavorite: saloon.isFavorite || false,
        };
    })
        .sort((a, b) => b.avgRating - a.avgRating);
    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedSaloons = saloonsWithAvgRatings.slice(skip, skip + limit);
    return {
        data: paginatedSaloons,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
});
const addSaloonToFavoritesInDb = (userId, saloonOwnerId) => __awaiter(void 0, void 0, void 0, function* () {
    //check the saloon is exist or not
    const saloon = yield prisma_1.default.saloonOwner.findUnique({
        where: {
            userId: saloonOwnerId,
        },
    });
    if (!saloon) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Saloon not found');
    }
    // Check if the favorite already exists
    const existingFavorite = yield prisma_1.default.favoriteShop.findFirst({
        where: {
            userId: userId,
            saloonOwnerId: saloonOwnerId,
        },
    });
    if (existingFavorite) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon already in favorites');
    }
    const result = yield prisma_1.default.favoriteShop.create({
        data: {
            userId: userId,
            saloonOwnerId: saloonOwnerId,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon not added to favorites');
    }
    return result;
});
const getFavoriteSaloonsFromDb = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, query = {}) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    // Get total count
    const total = yield prisma_1.default.favoriteShop.count({
        where: {
            userId: userId,
        },
    });
    // Get paginated results
    const result = yield prisma_1.default.favoriteShop.findMany({
        where: {
            userId: userId,
        },
        include: {
            saloonOwner: {
                select: {
                    id: true,
                    userId: true,
                    shopName: true,
                    shopAddress: true,
                    shopImages: true,
                    shopLogo: true,
                    shopVideo: true,
                    latitude: true,
                    longitude: true,
                    ratingCount: true,
                    avgRating: true,
                },
            },
        },
        skip,
        take: limit,
        orderBy: {
            createdAt: 'desc',
        },
    });
    const favorites = result.map(fav => fav.saloonOwner);
    return {
        data: favorites,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
});
const removeSaloonFromFavoritesInDb = (userId, saloonOwnerId) => __awaiter(void 0, void 0, void 0, function* () {
    // Check if the favorite exists
    const existingFavorite = yield prisma_1.default.favoriteShop.findFirst({
        where: {
            userId: userId,
            saloonOwnerId: saloonOwnerId,
        },
    });
    if (!existingFavorite) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon not found in favorites');
    }
    const deletedItem = yield prisma_1.default.favoriteShop.delete({
        where: {
            userId_saloonOwnerId: {
                userId: userId,
                saloonOwnerId: saloonOwnerId,
            },
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon not removed from favorites');
    }
    return deletedItem;
});
const getSaloonAllServicesListFromDb = (saloonOwnerId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.service.findMany({
        where: {
            saloonOwnerId: saloonOwnerId,
            isActive: true,
        },
        select: {
            id: true,
            serviceName: true,
            price: true,
            duration: true,
            saloonOwnerId: true,
            user: {
                select: {
                    SaloonOwner: {
                        select: {
                            userId: true,
                            shopName: true,
                            shopLogo: true,
                            shopAddress: true,
                        },
                    },
                },
            },
        },
    });
    if (result.length === 0) {
        return [];
    }
    return result.map(service => {
        var _a, _b;
        const saloon = (_b = (_a = service.user) === null || _a === void 0 ? void 0 : _a.SaloonOwner) === null || _b === void 0 ? void 0 : _b[0];
        return {
            id: service.id,
            name: service.serviceName,
            price: service.price,
            duration: service.duration,
            // isActive: service.isActive,
            saloonOwnerId: service.saloonOwnerId,
            saloon: saloon
                ? {
                    saloonId: saloon.userId,
                    shopName: saloon.shopName,
                    shopLogo: saloon.shopLogo,
                    shopAddress: saloon.shopAddress,
                }
                : null,
        };
    });
});
const getVisitedSaloonListFromDb = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, query = {}) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    // Get all visited saloonOwnerIds for the user (deduplicated)
    const allVisits = yield prisma_1.default.customerVisit.findMany({
        where: {
            customerId: userId,
        },
        select: {
            saloonOwnerId: true,
            customer: {
                select: {
                    fullName: true,
                    email: true,
                    phoneNumber: true,
                    image: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    const distinctSaloonIds = Array.from(new Set(allVisits.map(v => v.saloonOwnerId))).filter(Boolean);
    const total = distinctSaloonIds.length;
    // Apply pagination on distinct saloon ids
    const pagedSaloonIds = distinctSaloonIds.slice(skip, skip + limit);
    if (pagedSaloonIds.length === 0) {
        return {
            data: [],
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    // Get the latest visit record per saloon for this user (to provide visit detail like lastVisited)
    const visits = yield prisma_1.default.customerVisit.findMany({
        where: {
            customerId: userId,
            saloonOwnerId: { in: pagedSaloonIds },
        },
        // select minimal safe fields; adjust if your model has other visit fields you want to expose
        select: {
            saloonOwnerId: true,
            createdAt: true, // used as lastVisitedAt
            // If your CustomerVisit has a visitCount or totalVisits field, add it here, e.g. visitCount: true
            saloon: {
                select: {
                    userId: true,
                    shopName: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    // Get loyalty info for these saloons in a single query
    const loyalties = yield prisma_1.default.customerLoyalty.findMany({
        where: {
            userId,
            saloonOwnerId: { in: pagedSaloonIds },
        },
        select: {
            saloonOwnerId: true,
            totalPoints: true,
            // add other loyalty fields you need, e.g. tier: true
        },
    });
    const loyaltyBySaloon = loyalties.reduce((acc, l) => {
        acc[l.saloonOwnerId] = l;
        return acc;
    }, {});
    // Build final list preserving pagination order
    const loyaltySchemes = yield prisma_1.default.loyaltyScheme.findMany({
        where: {
            userId: { in: pagedSaloonIds },
        },
        select: {
            userId: true,
            pointThreshold: true,
            percentage: true,
        },
    });
    // console.log(loyaltySchemes);
    const schemesBySaloon = loyaltySchemes.reduce((acc, s) => {
        acc[s.userId] = acc[s.userId] || [];
        acc[s.userId].push(s);
        return acc;
    }, {});
    // Sort schemes for each saloon by descending pointThreshold (highest first)
    Object.values(schemesBySaloon).forEach(arr => arr.sort((a, b) => { var _a, _b; return ((_a = b.pointThreshold) !== null && _a !== void 0 ? _a : 0) - ((_b = a.pointThreshold) !== null && _b !== void 0 ? _b : 0); }));
    // Pick the best applicable scheme per saloon based on the customer's totalPoints.
    // If the customer has no loyalty record for a saloon, or doesn't meet any threshold,
    // the mapping will contain null (meaning not eligible).
    const loyaltySchemeBySaloon = {};
    Object.keys(schemesBySaloon).forEach(salId => {
        const schemes = schemesBySaloon[salId];
        const loyalty = loyaltyBySaloon[salId];
        if (loyalty && Array.isArray(schemes) && schemes.length > 0) {
            // find highest threshold that the customer qualifies for
            const matched = schemes.find(sch => { var _a, _b; return ((_a = loyalty.totalPoints) !== null && _a !== void 0 ? _a : 0) >= ((_b = sch.pointThreshold) !== null && _b !== void 0 ? _b : 0); });
            loyaltySchemeBySaloon[salId] = matched !== null && matched !== void 0 ? matched : null;
        }
        else {
            loyaltySchemeBySaloon[salId] = null;
        }
    });
    const data = pagedSaloonIds.map(sid => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const visit = visits.find(v => v.saloonOwnerId === sid);
        const loyalty = loyaltyBySaloon[sid];
        const scheme = loyaltySchemeBySaloon[sid];
        // get the customer's last visit record for this saloon (if any)
        const customerVisit = allVisits.find(v => v.saloonOwnerId === sid);
        // All schemes available for this saloon (may be empty)
        const schemes = (_a = schemesBySaloon[sid]) !== null && _a !== void 0 ? _a : [];
        // Build offers array with eligibility info so customer can choose
        const offers = schemes.map((sch, idx) => {
            var _a, _b, _c;
            const threshold = Number((_a = sch.pointThreshold) !== null && _a !== void 0 ? _a : 0);
            const percentage = Number((_b = sch.percentage) !== null && _b !== void 0 ? _b : 0);
            const totalPoints = Number((_c = loyalty === null || loyalty === void 0 ? void 0 : loyalty.totalPoints) !== null && _c !== void 0 ? _c : 0);
            const eligible = totalPoints >= threshold;
            return {
                // include a local identifier in case scheme lacks an id
                schemeKey: `${sid}#${idx}`,
                pointThreshold: threshold,
                percentage,
                eligible,
                pointsNeeded: Math.max(0, threshold - totalPoints),
                // raw scheme (optional) - keep minimal to avoid leaking unrelated fields
                // raw: {
                // userId: sch.userId,
                // pointThreshold: sch.pointThreshold,
                // percentage: sch.percentage,
                // },
            };
        });
        // Only the offers customer can actually use right now
        const applicableOffers = offers.filter((o) => o.eligible);
        const offerEligible = !!(loyalty &&
            scheme &&
            loyalty.totalPoints >= scheme.pointThreshold);
        const offerPercentage = offerEligible ? ((_b = scheme.percentage) !== null && _b !== void 0 ? _b : 0) : 0;
        return {
            saloonOwnerId: sid,
            shopName: (_d = (_c = visit === null || visit === void 0 ? void 0 : visit.saloon) === null || _c === void 0 ? void 0 : _c.shopName) !== null && _d !== void 0 ? _d : null,
            customerName: (_f = (_e = customerVisit === null || customerVisit === void 0 ? void 0 : customerVisit.customer) === null || _e === void 0 ? void 0 : _e.fullName) !== null && _f !== void 0 ? _f : null,
            customerImage: (_h = (_g = customerVisit === null || customerVisit === void 0 ? void 0 : customerVisit.customer) === null || _g === void 0 ? void 0 : _g.image) !== null && _h !== void 0 ? _h : null,
            visitCount: visits.filter(v => v.saloonOwnerId === sid).length,
            lastVisitedAt: (_j = visit === null || visit === void 0 ? void 0 : visit.createdAt) !== null && _j !== void 0 ? _j : null,
            totalPoints: (_k = loyalty === null || loyalty === void 0 ? void 0 : loyalty.totalPoints) !== null && _k !== void 0 ? _k : 0,
            // legacy single best offer info (kept for compatibility)
            // offerEligible,
            // offerPercentage,
            // new arrays for customers to choose from
            offers, // all offers defined for this saloon with eligibility flags
            applicableOffers, // only offers the customer currently qualifies for
        };
    });
    return {
        data,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
});
const getMyLoyaltyOffersFromDb = (userId, saloonOwnerId) => __awaiter(void 0, void 0, void 0, function* () {
    // Get all loyalty applicable offers available from a saloon for me as a customer
    const existingPoints = yield prisma_1.default.customerLoyalty.findMany({
        where: {
            userId,
            saloonOwnerId,
        },
        select: {
            totalPoints: true,
        },
    });
    // sum up total points
    let totalPoints = existingPoints.reduce((sum, rec) => sum + (rec.totalPoints || 0), 0);
    const loyaltySchemes = yield prisma_1.default.loyaltyScheme.findMany({
        where: {
            userId: saloonOwnerId,
        },
        select: {
            id: true,
            pointThreshold: true,
            percentage: true,
        },
        orderBy: {
            pointThreshold: 'desc',
        },
    });
    // Build offers array with eligibility info
    const offers = loyaltySchemes
        .filter(sch => {
        var _a;
        const threshold = Number((_a = sch.pointThreshold) !== null && _a !== void 0 ? _a : 0);
        return totalPoints >= threshold;
    })
        .map(sch => {
        var _a, _b;
        const threshold = Number((_a = sch.pointThreshold) !== null && _a !== void 0 ? _a : 0);
        const percentage = Number((_b = sch.percentage) !== null && _b !== void 0 ? _b : 0);
        const eligible = true;
        return {
            id: sch.id,
            pointThreshold: threshold,
            percentage,
            eligible,
            pointsNeeded: 0,
        };
    });
    // filter with availed offers already to include only those not yet availed
    const availedOffers = yield prisma_1.default.loyaltyRedemption.findMany({
        where: {
            customerId: userId,
            LoyaltyScheme: {
                userId: saloonOwnerId,
            },
        },
        select: {
            LoyaltyScheme: {
                select: {
                    id: true,
                    pointThreshold: true,
                    percentage: true,
                },
            },
        },
    });
    const totalPointsUsed = yield prisma_1.default.loyaltyRedemption.aggregate({
        where: {
            customerId: userId,
            LoyaltyScheme: {
                userId: saloonOwnerId,
            },
        },
        _sum: {
            pointsUsed: true,
        },
    });
    const usedPoints = totalPointsUsed._sum.pointsUsed || 0;
    totalPoints = totalPoints - usedPoints;
    const availedSet = new Set(availedOffers.map(ao => `${ao.LoyaltyScheme.id}#${ao.LoyaltyScheme.pointThreshold}#${ao.LoyaltyScheme.percentage}`));
    const filteredOffers = offers.filter(offer => {
        const key = `${offer.id}#${offer.pointThreshold}#${offer.percentage}`;
        return !availedSet.has(key);
    });
    return {
        totalPoints,
        filteredOffers,
    };
});
const getCustomerByIdFromDb = (userId, customerId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.user.findUnique({
        where: {
            id: customerId,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'customer not found');
    }
    // check following or not
    const isFollowing = yield prisma_1.default.follow.findFirst({
        where: {
            userId: userId,
            followingId: customerId,
        },
    });
    return {
        isMe: result.id === userId,
        id: result.id,
        fullName: result.fullName,
        email: result.email,
        phoneNumber: result.phoneNumber,
        image: result.image,
        address: result.address,
        isFollowing: isFollowing ? true : false,
    };
});
const updateCustomerIntoDb = (userId, customerId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonOwner.update({
        where: {
            id: customerId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'customerId, not updated');
    }
    return result;
});
const deleteCustomerItemFromDb = (userId, customerId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.saloonOwner.delete({
        where: {
            id: customerId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'customerId, not deleted');
    }
    return deletedItem;
});
exports.customerService = {
    createCustomerIntoDb,
    analyzeSaloonFromImageInDb,
    getAllSaloonListFromDb,
    getMyNearestSaloonListFromDb,
    getTopRatedSaloonsFromDb,
    getSaloonAllServicesListFromDb,
    getCustomerByIdFromDb,
    getVisitedSaloonListFromDb,
    getMyLoyaltyOffersFromDb,
    addSaloonToFavoritesInDb,
    getFavoriteSaloonsFromDb,
    removeSaloonFromFavoritesInDb,
    updateCustomerIntoDb,
    deleteCustomerItemFromDb,
};
