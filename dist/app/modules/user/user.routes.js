"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRouters = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_controller_1 = require("../user/user.controller");
const user_validation_1 = require("../user/user.validation");
const multipleFile_1 = require("../../utils/multipleFile");
const parseBody_1 = require("../../middlewares/parseBody");
const router = express_1.default.Router();
router.post('/register', (0, validateRequest_1.default)(user_validation_1.UserValidations.registerUser), user_controller_1.UserControllers.registerUser);
router.post('/register/saloon-owner', multipleFile_1.multerUploadMultiple.fields([
    { name: 'shop_logo', maxCount: 1 },
    { name: 'shop_images', maxCount: 5 },
    { name: 'shop_videos', maxCount: 2 },
]), parseBody_1.parseBody, (0, validateRequest_1.default)(user_validation_1.UserValidations.createSaloonOwner), user_controller_1.UserControllers.registerSaloonOwner);
router.patch('/update/saloon-owner', multipleFile_1.multerUploadMultiple.fields([
    { name: 'shop_logo', maxCount: 1 },
    { name: 'shop_images', maxCount: 5 },
    { name: 'shop_videos', maxCount: 2 },
]), parseBody_1.parseBody, (0, auth_1.default)(), (0, validateRequest_1.default)(user_validation_1.UserValidations.updateSaloonOwner), user_controller_1.UserControllers.updateSaloonOwner);
router.put('/update/barber', multipleFile_1.multerUploadMultiple.fields([
    { name: 'portfolioImages', maxCount: 5 },
]), parseBody_1.parseBody, (0, auth_1.default)(), (0, validateRequest_1.default)(user_validation_1.UserValidations.updateBarber), user_controller_1.UserControllers.updateBarber);
router.put('/verify-otp', (0, validateRequest_1.default)(user_validation_1.UserValidations.verifyOtpSchema), user_controller_1.UserControllers.verifyOtp);
router.get('/me', (0, auth_1.default)(), user_controller_1.UserControllers.getMyProfile);
router.put('/update-profile', (0, auth_1.default)(), (0, validateRequest_1.default)(user_validation_1.UserValidations.updateProfileSchema), user_controller_1.UserControllers.updateMyProfile);
router.post('/resend-verification-email', (0, validateRequest_1.default)(user_validation_1.UserValidations.forgetPasswordSchema), user_controller_1.UserControllers.resendUserVerificationEmail);
router.put('/change-password', (0, auth_1.default)(), user_controller_1.UserControllers.changePassword);
router.post('/forgot-password', (0, validateRequest_1.default)(user_validation_1.UserValidations.forgetPasswordSchema), user_controller_1.UserControllers.forgotPassword);
router.post('/resend-otp', (0, validateRequest_1.default)(user_validation_1.UserValidations.forgetPasswordSchema), user_controller_1.UserControllers.resendOtp);
router.put('/verify-otp-forgot-password', (0, validateRequest_1.default)(user_validation_1.UserValidations.verifyOtpSchema), user_controller_1.UserControllers.verifyOtpForgotPassword);
router.put('/update-password', (0, validateRequest_1.default)(user_validation_1.UserValidations.updatePasswordSchema), user_controller_1.UserControllers.updatePassword);
router.post('/social-sign-up', (0, validateRequest_1.default)(user_validation_1.UserValidations.socialLoginSchema), user_controller_1.UserControllers.socialLogin);
router.post('/delete-account', (0, auth_1.default)(), user_controller_1.UserControllers.deleteAccount);
router.put('/update-profile-image', multipleFile_1.multerUploadMultiple.single('profileImage'), (0, auth_1.default)(), user_controller_1.UserControllers.updateProfileImage);
exports.UserRouters = router;
