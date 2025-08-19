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
exports.UserControllers = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const user_service_1 = require("../user/user.service");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const multipleFile_1 = require("../../utils/multipleFile");
const registerUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_service_1.UserServices.registerUserIntoDB(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        message: 'User registered successfully',
        data: result,
    });
}));
const resendUserVerificationEmail = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    const result = yield user_service_1.UserServices.resendUserVerificationEmail(email);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        message: 'Verification email sent successfully',
        data: result,
    });
}));
const registerSaloonOwner = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { files, body } = req;
    const uploads = {
        shopImages: [],
        shopVideos: [],
    };
    const fileGroups = files;
    // Upload shop logo
    if ((_a = fileGroups.shop_logo) === null || _a === void 0 ? void 0 : _a[0]) {
        uploads.shopLogo = yield (0, multipleFile_1.uploadFileToSpace)(fileGroups.shop_logo[0], 'saloon-logos');
    }
    // Upload shop images
    if ((_b = fileGroups.shop_images) === null || _b === void 0 ? void 0 : _b.length) {
        const imageUploads = yield Promise.all(fileGroups.shop_images.map(file => (0, multipleFile_1.uploadFileToSpace)(file, 'saloon-images')));
        uploads.shopImages.push(...imageUploads);
    }
    // Upload shop videos
    if ((_c = fileGroups.shop_videos) === null || _c === void 0 ? void 0 : _c.length) {
        const videoUploads = yield Promise.all(fileGroups.shop_videos.map(file => (0, multipleFile_1.uploadFileToSpace)(file, 'saloon-videos')));
        uploads.shopVideos.push(...videoUploads);
    }
    const payload = Object.assign(Object.assign({}, body), { shopLogo: uploads.shopLogo, shopImages: uploads.shopImages, shopVideo: uploads.shopVideos ? uploads.shopVideos : [] });
    const result = yield user_service_1.UserServices.registerSaloonOwnerIntoDB(payload);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        message: 'Saloon owner profile completed successfully',
        data: result,
    });
}));
const updateSaloonOwner = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _d, _e, _f;
    const user = req.user;
    const { files, body } = req;
    const uploads = {
        shopImages: [],
        shopVideos: [],
    };
    const fileGroups = files;
    // Upload shop logo (optional)
    if ((_d = fileGroups.shop_logo) === null || _d === void 0 ? void 0 : _d[0]) {
        uploads.shopLogo = yield (0, multipleFile_1.uploadFileToSpace)(fileGroups.shop_logo[0], 'saloon-logos');
    }
    // Upload shop images (optional)
    if ((_e = fileGroups.shop_images) === null || _e === void 0 ? void 0 : _e.length) {
        const imageUploads = yield Promise.all(fileGroups.shop_images.map(file => (0, multipleFile_1.uploadFileToSpace)(file, 'saloon-images')));
        uploads.shopImages.push(...imageUploads);
    }
    // Upload shop videos (optional)
    if ((_f = fileGroups.shop_videos) === null || _f === void 0 ? void 0 : _f.length) {
        const videoUploads = yield Promise.all(fileGroups.shop_videos.map(file => (0, multipleFile_1.uploadFileToSpace)(file, 'saloon-videos')));
        uploads.shopVideos.push(...videoUploads);
    }
    const payload = Object.assign(Object.assign({}, body), { shopLogo: uploads.shopLogo, shopImages: uploads.shopImages, shopVideo: uploads.shopVideos ? uploads.shopVideos : [] });
    const result = yield user_service_1.UserServices.updateSaloonOwnerIntoDB(user.id, payload);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        message: 'Saloon owner updated successfully',
        data: result,
    });
}));
const updateBarber = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _g;
    const user = req.user;
    const { files, body } = req;
    const uploads = {
        portfolioImages: [],
    };
    const fileGroups = files;
    // Upload profile image (optional)
    // if (fileGroups?.profileImage?.[0]) {
    //   uploads.profileImage = await uploadFileToSpace(fileGroups.profileImage[0], 'barber-profile-images');
    // }
    // Upload portfolio images (optional)
    if ((_g = fileGroups === null || fileGroups === void 0 ? void 0 : fileGroups.portfolioImages) === null || _g === void 0 ? void 0 : _g.length) {
        const uploadedImages = yield Promise.all(fileGroups.portfolioImages.map(file => (0, multipleFile_1.uploadFileToSpace)(file, 'barber-portfolio')));
        uploads.portfolioImages.push(...uploadedImages);
    }
    const payload = Object.assign(Object.assign({}, body), { portfolio: uploads.portfolioImages });
    const result = yield user_service_1.UserServices.updateBarberIntoDB(user.id, payload);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        message: 'Barber registered successfully',
        data: result,
    });
}));
const getMyProfile = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield user_service_1.UserServices.getMyProfileFromDB(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        message: 'Profile retrieved successfully',
        data: result,
    });
}));
const updateMyProfile = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield user_service_1.UserServices.updateMyProfileIntoDB(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        message: 'User profile updated successfully',
        data: result,
    });
}));
const changePassword = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield user_service_1.UserServices.changePassword(user, user.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        message: 'Password changed successfully',
        data: result,
    });
}));
const forgotPassword = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_service_1.UserServices.forgotPassword(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        message: 'Please check your email to get the otp!',
        data: result,
    });
}));
const resendOtp = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_service_1.UserServices.resendOtpIntoDB(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'OTP sent successfully!',
        data: result,
    });
}));
const verifyOtp = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_service_1.UserServices.verifyOtpInDB(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'OTP verified successfully!',
        data: result,
    });
}));
const verifyOtpForgotPassword = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_service_1.UserServices.verifyOtpForgotPasswordInDB(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'OTP verified successfully!',
        data: result,
    });
}));
const socialLogin = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_service_1.UserServices.socialLoginIntoDB(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        message: 'User logged in successfully',
        data: result,
    });
}));
const updatePassword = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_service_1.UserServices.updatePasswordIntoDb(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: result.message,
        data: result,
    });
}));
const deleteAccount = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    yield user_service_1.UserServices.deleteAccountFromDB(user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        data: null,
        message: 'Account deleted successfully',
    });
}));
const updateProfileImage = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const file = req.file;
    if (!file) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Profile image file is required.');
    }
    // Upload to DigitalOcean
    const fileUrl = yield (0, multipleFile_1.uploadFileToSpace)(file, 'user-profile-images');
    // Update DB
    const result = yield user_service_1.UserServices.updateProfileImageIntoDB(user.id, fileUrl);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        message: 'Profile image updated successfully',
        data: result,
    });
}));
exports.UserControllers = {
    registerUser,
    registerSaloonOwner,
    updateSaloonOwner,
    updateBarber,
    getMyProfile,
    updateMyProfile,
    changePassword,
    verifyOtpForgotPassword,
    forgotPassword,
    verifyOtp,
    socialLogin,
    updatePassword,
    resendUserVerificationEmail,
    resendOtp,
    deleteAccount,
    updateProfileImage
};
