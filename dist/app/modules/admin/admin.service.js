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
exports.adminService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const pagination_1 = require("../../utils/pagination");
const searchFilter_1 = require("../../utils/searchFilter");
const config_1 = __importDefault(require("../../../config"));
const getSaloonFromDb = (userId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    const whereClause = (0, searchFilter_1.buildCompleteQuery)({
        searchTerm: options.searchTerm,
        searchFields: ['fullName', 'email', 'phoneNumber'],
    }, {
        role: client_1.UserRoleEnum.SALOON_OWNER,
        status: options.status || client_1.UserStatus.ACTIVE,
    }, {
        startDate: options.startDate,
        endDate: options.endDate,
        dateField: 'createdAt',
    });
    // Handle SaloonOwner specific filters
    if (options.isVerified !== undefined) {
        whereClause.SaloonOwner = {
            isVerified: options.isVerified === true,
        };
    }
    const [saloons, total] = yield Promise.all([
        prisma_1.default.user.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                status: true,
                createdAt: true,
                SaloonOwner: {
                    select: {
                        userId: true,
                        isVerified: true,
                        shopAddress: true,
                        shopName: true,
                        registrationNumber: true,
                        shopLogo: true,
                        shopImages: true,
                        shopVideo: true,
                        ratingCount: true,
                        avgRating: true,
                    },
                },
            },
        }),
        prisma_1.default.user.count({
            where: whereClause,
        }),
    ]);
    // Flatten the response so that SaloonOwner fields are at the top level
    const flattenedSaloons = saloons.map(saloon => {
        const { SaloonOwner } = saloon, userFields = __rest(saloon, ["SaloonOwner"]);
        const owner = Array.isArray(SaloonOwner) ? SaloonOwner[0] : SaloonOwner;
        return Object.assign(Object.assign({}, userFields), { userId: owner === null || owner === void 0 ? void 0 : owner.userId, isVerified: owner === null || owner === void 0 ? void 0 : owner.isVerified, shopPhoneNumber: userFields.phoneNumber, shopAddress: owner === null || owner === void 0 ? void 0 : owner.shopAddress, shopName: owner === null || owner === void 0 ? void 0 : owner.shopName, registrationNumber: owner === null || owner === void 0 ? void 0 : owner.registrationNumber, shopLogo: owner === null || owner === void 0 ? void 0 : owner.shopLogo, shopImages: owner === null || owner === void 0 ? void 0 : owner.shopImages, shopVideo: owner === null || owner === void 0 ? void 0 : owner.shopVideo, ratingCount: (owner === null || owner === void 0 ? void 0 : owner.ratingCount) || 0, avgRating: (owner === null || owner === void 0 ? void 0 : owner.avgRating) || 0 });
    });
    return (0, pagination_1.formatPaginationResponse)(flattenedSaloons, total, page, limit);
});
const getNewSaloonFromDb = (userId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    // Only fetch SaloonOwners where isVerified is false
    const whereClause = Object.assign({ isVerified: false }, (options.startDate || options.endDate
        ? {
            createdAt: Object.assign(Object.assign({}, (options.startDate ? { gte: options.startDate } : {})), (options.endDate ? { lte: options.endDate } : {})),
        }
        : {}));
    const [saloons, total] = yield Promise.all([
        prisma_1.default.saloonOwner.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            select: {
                userId: true,
                isVerified: true,
                shopAddress: true,
                shopName: true,
                registrationNumber: true,
                shopLogo: true,
                shopImages: true,
                shopVideo: true,
                ratingCount: true,
                avgRating: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phoneNumber: true,
                        status: true,
                        createdAt: true,
                    },
                },
            },
        }),
        prisma_1.default.saloonOwner.count({
            where: whereClause,
        }),
    ]);
    // Flatten the response so that user fields and SaloonOwner fields are at the top level
    const flattenedSaloons = saloons.map(saloon => {
        const { user } = saloon, ownerFields = __rest(saloon, ["user"]);
        return Object.assign(Object.assign(Object.assign({}, ownerFields), user), { shopPhoneNumber: user.phoneNumber, ratingCount: ownerFields.ratingCount || 0, avgRating: ownerFields.avgRating || 0 });
    });
    return (0, pagination_1.formatPaginationResponse)(flattenedSaloons, total, page, limit);
});
const getSaloonByIdFromDb = (userId, saloonOwnerId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const result = yield prisma_1.default.user.findUnique({
        where: {
            id: saloonOwnerId,
            role: client_1.UserRoleEnum.SALOON_OWNER,
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            status: true,
            stripeAccountId: true,
            stripeAccountUrl: true,
            SaloonOwner: {
                select: {
                    userId: true,
                    isVerified: true,
                    shopAddress: true,
                    shopName: true,
                    registrationNumber: true,
                    shopLogo: true,
                    shopImages: true,
                    shopVideo: true,
                    ratingCount: true,
                    avgRating: true,
                    Barber: {
                        select: {
                            userId: true,
                            portfolio: true,
                            experienceYears: true,
                            skills: true,
                            bio: true,
                            ratingCount: true,
                            avgRating: true,
                            user: {
                                select: {
                                    id: true,
                                    image: true,
                                    fullName: true,
                                    email: true,
                                    phoneNumber: true,
                                    status: true,
                                },
                            },
                        },
                    },
                },
            },
            SaloonSchedule: {
                select: {
                    dayOfWeek: true,
                    dayName: true,
                    openingTime: true,
                    closingTime: true,
                    isActive: true,
                },
            },
            Service: {
                select: {
                    id: true,
                    serviceName: true,
                    availableTo: true,
                    price: true,
                    duration: true,
                },
            },
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Saloon not found');
    }
    // Handle SaloonOwner as array or object
    const saloonOwner = Array.isArray(result.SaloonOwner)
        ? result.SaloonOwner[0]
        : result.SaloonOwner;
    //get bank details from the stripe
    const stripe = require('stripe')(config_1.default.stripe.stripe_secret_key);
    let account = null;
    let bankName = null;
    let accountHolderName = null;
    let branchCity = null;
    let branchCode = null;
    let accountNumber = null;
    if ((saloonOwner === null || saloonOwner === void 0 ? void 0 : saloonOwner.isVerified) && result.stripeAccountId) {
        account = yield stripe.accounts.retrieve(result.stripeAccountId);
        const bankAccount = (_b = (_a = account === null || account === void 0 ? void 0 : account.external_accounts) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.find((acc) => acc.object === 'bank_account');
        bankName = (bankAccount === null || bankAccount === void 0 ? void 0 : bankAccount.bank_name) || null;
        accountHolderName =
            ((_c = account === null || account === void 0 ? void 0 : account.individual) === null || _c === void 0 ? void 0 : _c.first_name) && ((_d = account === null || account === void 0 ? void 0 : account.individual) === null || _d === void 0 ? void 0 : _d.last_name)
                ? `${account.individual.first_name} ${account.individual.last_name}`
                : null;
        branchCity = (bankAccount === null || bankAccount === void 0 ? void 0 : bankAccount.bank_name) || null;
        branchCode = (bankAccount === null || bankAccount === void 0 ? void 0 : bankAccount.routing_number) || null;
        accountNumber = (bankAccount === null || bankAccount === void 0 ? void 0 : bankAccount.last4) ? `****${bankAccount.last4}` : null;
    }
    return {
        saloonOwnerIdd: result.id,
        fullName: result.fullName,
        email: result.email,
        phoneNumber: result.phoneNumber,
        status: result.status,
        isVerified: (saloonOwner === null || saloonOwner === void 0 ? void 0 : saloonOwner.isVerified) || false,
        shopAddress: (saloonOwner === null || saloonOwner === void 0 ? void 0 : saloonOwner.shopAddress) || '',
        shopName: (saloonOwner === null || saloonOwner === void 0 ? void 0 : saloonOwner.shopName) || '',
        registrationNumber: (saloonOwner === null || saloonOwner === void 0 ? void 0 : saloonOwner.registrationNumber) || '',
        shopLogo: (saloonOwner === null || saloonOwner === void 0 ? void 0 : saloonOwner.shopLogo) || null,
        shopImages: (saloonOwner === null || saloonOwner === void 0 ? void 0 : saloonOwner.shopImages) || [],
        shopVideo: (saloonOwner === null || saloonOwner === void 0 ? void 0 : saloonOwner.shopVideo) || null,
        ratingCount: (saloonOwner === null || saloonOwner === void 0 ? void 0 : saloonOwner.ratingCount) || 0,
        avgRating: (saloonOwner === null || saloonOwner === void 0 ? void 0 : saloonOwner.avgRating) || 0,
        schedule: result.SaloonSchedule || [],
        barbers: ((_e = saloonOwner === null || saloonOwner === void 0 ? void 0 : saloonOwner.Barber) === null || _e === void 0 ? void 0 : _e.map(barber => {
            var _a, _b, _c, _d, _e;
            return ({
                barberId: barber.userId,
                Image: ((_a = barber.user) === null || _a === void 0 ? void 0 : _a.image) || null,
                fullName: ((_b = barber.user) === null || _b === void 0 ? void 0 : _b.fullName) || '',
                email: ((_c = barber.user) === null || _c === void 0 ? void 0 : _c.email) || '',
                phoneNumber: ((_d = barber.user) === null || _d === void 0 ? void 0 : _d.phoneNumber) || '',
                status: ((_e = barber.user) === null || _e === void 0 ? void 0 : _e.status) || 'INACTIVE',
                portfolio: barber.portfolio || [],
                experienceYears: barber.experienceYears || 0,
                skills: barber.skills || [],
                bio: barber.bio || '',
                ratingCount: barber.ratingCount || 0,
                avgRating: barber.avgRating || 0,
            });
        })) || [],
        services: result.Service || [],
        bankDetails: {
            bankName,
            accountHolderName,
            accountNumber,
            branchCity,
            branchCode,
        },
    };
});
const blockSaloonByIdIntoDb = (saloonOwnerId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { status } = data;
    const result = yield prisma_1.default.saloonOwner.update({
        where: {
            userId: saloonOwnerId,
        },
        data: {
            isVerified: status,
        },
        select: {
            userId: true,
            isVerified: true,
            shopAddress: true,
            shopName: true,
            registrationNumber: true,
            shopLogo: true,
            shopImages: true,
            shopVideo: true,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon not found or not updated');
    }
    const updateUser = yield prisma_1.default.user.update({
        where: {
            id: saloonOwnerId,
        },
        data: {
            status: status === true ? client_1.UserStatus.ACTIVE : client_1.UserStatus.BLOCKED,
        },
    });
    if (!updateUser) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'User status not updated for the saloon owner');
    }
    return result;
});
const getBarbersListFromDb = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    const whereClause = (0, searchFilter_1.buildCompleteQuery)({
        searchTerm: options.searchTerm,
        searchFields: ['fullName', 'email', 'phoneNumber'],
    }, {
        role: client_1.UserRoleEnum.BARBER,
        status: options.status,
    }, {
        startDate: options.startDate,
        endDate: options.endDate,
        dateField: 'createdAt',
    });
    // Handle Barber specific filters
    if (options.experienceYears !== undefined) {
        whereClause.Barber = {
            experienceYears: {
                gte: Number(options.experienceYears),
            },
        };
    }
    const [barbers, total] = yield Promise.all([
        prisma_1.default.user.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            select: {
                // id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                status: true,
                Barber: {
                    select: {
                        userId: true,
                        portfolio: true,
                        experienceYears: true,
                        skills: true,
                        bio: true,
                        ratingCount: true,
                        avgRating: true,
                        saloonOwner: {
                            select: {
                                id: true,
                                shopName: true,
                                shopAddress: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma_1.default.user.count({
            where: whereClause,
        }),
    ]);
    // Flatten the response so that Barber fields are at the top level
    const flattenedBarbers = barbers.map(barber => {
        var _a, _b, _c, _d, _e, _f;
        const { Barber } = barber, userFields = __rest(barber, ["Barber"]);
        return Object.assign(Object.assign({}, userFields), { userId: Barber === null || Barber === void 0 ? void 0 : Barber.userId, portfolio: Barber === null || Barber === void 0 ? void 0 : Barber.portfolio, experienceYears: Barber === null || Barber === void 0 ? void 0 : Barber.experienceYears, skills: Barber === null || Barber === void 0 ? void 0 : Barber.skills, bio: Barber === null || Barber === void 0 ? void 0 : Barber.bio, shopId: (_b = (_a = Barber === null || Barber === void 0 ? void 0 : Barber.saloonOwner) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null, shopName: (_d = (_c = Barber === null || Barber === void 0 ? void 0 : Barber.saloonOwner) === null || _c === void 0 ? void 0 : _c.shopName) !== null && _d !== void 0 ? _d : null, shopAddress: (_f = (_e = Barber === null || Barber === void 0 ? void 0 : Barber.saloonOwner) === null || _e === void 0 ? void 0 : _e.shopAddress) !== null && _f !== void 0 ? _f : null });
    });
    return (0, pagination_1.formatPaginationResponse)(flattenedBarbers, total, page, limit);
});
const getBarberByIdFromDb = (userId, barberId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    const result = yield prisma_1.default.user.findUnique({
        where: {
            id: barberId,
            role: client_1.UserRoleEnum.BARBER,
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            status: true,
            stripeAccountId: true,
            stripeAccountUrl: true,
            createdAt: true,
            Barber: {
                select: {
                    userId: true,
                    portfolio: true,
                    experienceYears: true,
                    skills: true,
                    bio: true,
                    ratingCount: true,
                    avgRating: true,
                    saloonOwner: {
                        select: {
                            id: true,
                            shopName: true,
                            shopAddress: true,
                            shopLogo: true,
                            shopImages: true,
                            shopVideo: true,
                        },
                    },
                },
            },
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Barber not found');
    }
    //get bank details from the stripe
    const stripe = require('stripe')(config_1.default.stripe.stripe_secret_key);
    let account = null;
    let bankName = null;
    let accountHolderName = null;
    let branchCity = null;
    let branchCode = null;
    let accountNumber = null;
    if (result.stripeAccountId) {
        account = yield stripe.accounts.retrieve(result.stripeAccountId);
        const bankAccount = (_b = (_a = account === null || account === void 0 ? void 0 : account.external_accounts) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.find((acc) => acc.object === 'bank_account');
        bankName = (bankAccount === null || bankAccount === void 0 ? void 0 : bankAccount.bank_name) || null;
        accountHolderName =
            ((_c = account === null || account === void 0 ? void 0 : account.individual) === null || _c === void 0 ? void 0 : _c.first_name) && ((_d = account === null || account === void 0 ? void 0 : account.individual) === null || _d === void 0 ? void 0 : _d.last_name)
                ? `${account.individual.first_name} ${account.individual.last_name}`
                : null;
        branchCity = (bankAccount === null || bankAccount === void 0 ? void 0 : bankAccount.bank_name) || null;
        branchCode = (bankAccount === null || bankAccount === void 0 ? void 0 : bankAccount.routing_number) || null;
        accountNumber = (bankAccount === null || bankAccount === void 0 ? void 0 : bankAccount.last4) ? `****${bankAccount.last4}` : null;
    }
    return {
        barberIdd: result.id,
        fullName: result.fullName,
        email: result.email,
        phoneNumber: result.phoneNumber,
        status: result.status,
        portfolio: ((_e = result.Barber) === null || _e === void 0 ? void 0 : _e.portfolio) || [],
        experienceYears: ((_f = result.Barber) === null || _f === void 0 ? void 0 : _f.experienceYears) || 0,
        skills: ((_g = result.Barber) === null || _g === void 0 ? void 0 : _g.skills) || [],
        bio: ((_h = result.Barber) === null || _h === void 0 ? void 0 : _h.bio) || '',
        shopId: ((_k = (_j = result.Barber) === null || _j === void 0 ? void 0 : _j.saloonOwner) === null || _k === void 0 ? void 0 : _k.id) || null,
        shopName: ((_m = (_l = result.Barber) === null || _l === void 0 ? void 0 : _l.saloonOwner) === null || _m === void 0 ? void 0 : _m.shopName) || null,
        shopAddress: ((_p = (_o = result.Barber) === null || _o === void 0 ? void 0 : _o.saloonOwner) === null || _p === void 0 ? void 0 : _p.shopAddress) || null,
        shopLogo: ((_r = (_q = result.Barber) === null || _q === void 0 ? void 0 : _q.saloonOwner) === null || _r === void 0 ? void 0 : _r.shopLogo) || null,
        shopImages: ((_t = (_s = result.Barber) === null || _s === void 0 ? void 0 : _s.saloonOwner) === null || _t === void 0 ? void 0 : _t.shopImages) || [],
        shopVideo: ((_v = (_u = result.Barber) === null || _u === void 0 ? void 0 : _u.saloonOwner) === null || _v === void 0 ? void 0 : _v.shopVideo) || null,
        ratingCount: ((_w = result.Barber) === null || _w === void 0 ? void 0 : _w.ratingCount) || 0,
        avgRating: ((_x = result.Barber) === null || _x === void 0 ? void 0 : _x.avgRating) || 0,
        bankDetails: {
            bankName,
            accountHolderName,
            accountNumber,
            branchCity,
            branchCode,
        },
    };
});
const blockBarberByIdIntoDb = (userId, barberId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.user.update({
        where: {
            id: barberId,
            role: client_1.UserRoleEnum.BARBER,
        },
        data: {
            status: data.status === true ? client_1.UserStatus.BLOCKED : client_1.UserStatus.ACTIVE,
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            status: true,
            createdAt: true,
            Barber: {
                select: {
                    userId: true,
                    portfolio: true,
                    experienceYears: true,
                    skills: true,
                    bio: true,
                },
            },
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber not found or not updated');
    }
    return result;
});
const getCustomersListFromDb = (userId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    const whereClause = (0, searchFilter_1.buildCompleteQuery)({
        searchTerm: options.searchTerm,
        searchFields: ['fullName', 'email', 'phoneNumber'],
    }, {
        role: client_1.UserRoleEnum.CUSTOMER,
        status: options.status,
    }, {
        startDate: options.startDate,
        endDate: options.endDate,
        dateField: 'createdAt',
    });
    const [customers, total] = yield Promise.all([
        prisma_1.default.user.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                gender: true,
                address: true,
                image: true,
                status: true,
                createdAt: true,
            },
        }),
        prisma_1.default.user.count({
            where: whereClause,
        }),
    ]);
    return (0, pagination_1.formatPaginationResponse)(customers, total, page, limit);
});
const blockCustomerByIdIntoDb = (userId, customerId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.user.update({
        where: {
            id: customerId,
            role: client_1.UserRoleEnum.CUSTOMER,
        },
        data: {
            status: data.status === true ? client_1.UserStatus.BLOCKED : client_1.UserStatus.ACTIVE,
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            image: true,
            status: true,
            createdAt: true,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Customer not found or not updated');
    }
    return result;
});
const updateSaloonOwnerByIdIntoDb = (userId, saloonOwnerId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { status } = data;
    const saloonOwner = yield prisma_1.default.saloonOwner.update({
        where: {
            userId: saloonOwnerId,
        },
        data: {
            isVerified: status === true ? true : false,
        },
    });
    if (!saloonOwner) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon owner not found or not updated');
    }
    return saloonOwner;
});
const getAdminDashboardFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const saloonCount = yield prisma_1.default.saloonOwner.count({
        where: {
            isVerified: true,
        },
    });
    const barberCount = yield prisma_1.default.user.count({
        where: {
            role: client_1.UserRoleEnum.BARBER,
            status: client_1.UserStatus.ACTIVE,
        },
    });
    const customerCount = yield prisma_1.default.user.count({
        where: {
            role: client_1.UserRoleEnum.CUSTOMER,
            status: client_1.UserStatus.ACTIVE,
        },
    });
    const totalEarnings = yield prisma_1.default.payment.aggregate({
        _sum: {
            paymentAmount: true,
        },
        where: {
            status: client_1.PaymentStatus.COMPLETED,
        },
    });
    const earningGrowth = yield prisma_1.default.payment.groupBy({
        by: ['createdAt'],
        _sum: {
            paymentAmount: true,
        },
        where: {
            status: 'COMPLETED',
            createdAt: {
                gte: new Date(new Date().setMonth(new Date().getMonth() - 1)), // Last month
            },
        },
        orderBy: { createdAt: 'asc' },
    });
    const userGrowth = yield prisma_1.default.user.groupBy({
        by: ['createdAt', 'role'],
        _count: {
            id: true,
        },
        where: {
            role: {
                in: [
                    client_1.UserRoleEnum.SALOON_OWNER,
                    client_1.UserRoleEnum.BARBER,
                    client_1.UserRoleEnum.CUSTOMER,
                ],
            },
            status: client_1.UserStatus.ACTIVE,
            createdAt: {
                gte: new Date(new Date().setMonth(new Date().getMonth() - 1)), // Last month
            },
        },
        orderBy: [{ createdAt: 'asc' }, { role: 'asc' }],
    });
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            label: d.toLocaleString('default', { month: 'short', year: 'numeric' }), // e.g. "Jan 2024"
            year: d.getFullYear(),
            month: d.getMonth(),
            total: 0,
        });
    }
    // Map earningGrowth to month index
    earningGrowth.forEach(item => {
        const date = new Date(item.createdAt);
        const idx = months.findIndex(m => m.year === date.getFullYear() && m.month === date.getMonth());
        if (idx !== -1) {
            months[idx].total += item._sum.paymentAmount || 0;
        }
    });
    // Prepare user growth per month with month name
    const userGrowthByMonth = [];
    months.forEach(month => {
        ['SALOON_OWNER', 'BARBER', 'CUSTOMER'].forEach(role => {
            const count = userGrowth
                .filter(item => item.role === role &&
                item.createdAt.getFullYear() === month.year &&
                item.createdAt.getMonth() === month.month)
                .reduce((sum, item) => sum + item._count.id, 0);
            userGrowthByMonth.push({
                month: month.label,
                role,
                count,
            });
        });
    });
    return {
        saloonCount,
        barberCount,
        customerCount,
        totalEarnings: totalEarnings._sum.paymentAmount || 0,
        earningGrowth: months.map(m => ({
            month: m.label,
            total: m.total,
        })),
        userGrowth: userGrowthByMonth.map(item => ({
            date: item.month, // Use the month label as the date
            role: item.role,
            count: item.count,
        })),
    };
});
const getSubscribersListFromDb = (userId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    // Build common where clause for search, filtering by date
    const whereClause = (0, searchFilter_1.buildCompleteQuery)({
        searchTerm: options.searchTerm,
        searchFields: ['fullName', 'email', 'phoneNumber'],
    }, {
        role: client_1.UserRoleEnum.SALOON_OWNER,
        status: client_1.UserStatus.ACTIVE,
    }, {
        startDate: options.startDate,
        endDate: options.endDate,
        dateField: 'createdAt',
    });
    const [subscribers, total] = yield Promise.all([
        prisma_1.default.user.findMany({
            where: Object.assign(Object.assign({}, whereClause), { UserSubscription: {
                    some: {
                        paymentStatus: client_1.PaymentStatus.COMPLETED, // Active subscription
                        endDate: { gte: new Date() }, // Not expired
                    },
                } }),
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                UserSubscription: {
                    where: {
                        paymentStatus: client_1.PaymentStatus.COMPLETED,
                        endDate: { gte: new Date() },
                    },
                    select: {
                        id: true,
                        startDate: true,
                        endDate: true,
                        stripeSubscriptionId: true,
                        paymentStatus: true,
                        subscriptionOffer: {
                            select: {
                                id: true,
                                title: true,
                                description: true,
                                price: true,
                                currency: true,
                                duration: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma_1.default.user.count({
            where: Object.assign(Object.assign({}, whereClause), { UserSubscription: {
                    some: {
                        paymentStatus: client_1.PaymentStatus.COMPLETED,
                        endDate: { gte: new Date() },
                    },
                } }),
        }),
    ]);
    // Flatten the response so that subscription fields are at the top level
    const flattenedSubscribers = subscribers.map(subscriber => {
        var _a;
        const subscription = (_a = subscriber.UserSubscription) === null || _a === void 0 ? void 0 : _a[0];
        return {
            id: subscriber.id,
            fullName: subscriber.fullName,
            email: subscriber.email,
            phoneNumber: subscriber.phoneNumber,
            subscriptionId: (subscription === null || subscription === void 0 ? void 0 : subscription.id) || null,
            startDate: (subscription === null || subscription === void 0 ? void 0 : subscription.startDate) || null,
            endDate: (subscription === null || subscription === void 0 ? void 0 : subscription.endDate) || null,
            stripeSubscriptionId: (subscription === null || subscription === void 0 ? void 0 : subscription.stripeSubscriptionId) || null,
            paymentStatus: (subscription === null || subscription === void 0 ? void 0 : subscription.paymentStatus) || null,
            offer: (subscription === null || subscription === void 0 ? void 0 : subscription.subscriptionOffer)
                ? {
                    id: subscription.subscriptionOffer.id,
                    title: subscription.subscriptionOffer.title,
                    description: subscription.subscriptionOffer.description,
                    price: subscription.subscriptionOffer.price,
                    currency: subscription.subscriptionOffer.currency,
                    duration: subscription.subscriptionOffer.duration,
                }
                : null,
        };
    });
    return (0, pagination_1.formatPaginationResponse)(flattenedSubscribers, total, page, limit);
});
exports.adminService = {
    getSaloonFromDb,
    getNewSaloonFromDb,
    getSaloonByIdFromDb,
    blockSaloonByIdIntoDb,
    getBarbersListFromDb,
    getBarberByIdFromDb,
    blockBarberByIdIntoDb,
    getCustomersListFromDb,
    blockCustomerByIdIntoDb,
    updateSaloonOwnerByIdIntoDb,
    getAdminDashboardFromDb,
    getSubscribersListFromDb,
};
