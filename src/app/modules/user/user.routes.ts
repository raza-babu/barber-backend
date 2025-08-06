import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { UserControllers } from '../user/user.controller';
import { UserValidations } from '../user/user.validation';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parseBody } from '../../middlewares/parseBody';
const router = express.Router();

router.post(
  '/register',
  validateRequest(UserValidations.registerUser),
  UserControllers.registerUser,
);

router.post(
  '/register/saloon-owner',
  multerUploadMultiple.fields([
    { name: 'shop_logo', maxCount: 1 },
    { name: 'shop_images', maxCount: 5 },
    { name: 'shop_videos', maxCount: 2 },
  ]),
  parseBody,
  validateRequest(UserValidations.createSaloonOwner),
  UserControllers.registerSaloonOwner,
);

router.patch(
  '/update/saloon-owner',
  multerUploadMultiple.fields([
    { name: 'shop_logo', maxCount: 1 },
    { name: 'shop_images', maxCount: 5 },
    { name: 'shop_videos', maxCount: 2 },
  ]),
  parseBody,
  validateRequest(UserValidations.createSaloonOwner),
  UserControllers.updateSaloonOwner,
);


router.put(
  '/update/barber',
  multerUploadMultiple.fields([
    { name: 'portfolioImages', maxCount: 5 },
  ]),
  parseBody,
  auth(),
  validateRequest(UserValidations.updateBarber),
  UserControllers.updateBarber,
)

router.put(
  '/verify-otp',
  validateRequest(UserValidations.verifyOtpSchema),
  UserControllers.verifyOtp,
);

router.get('/me', auth(), UserControllers.getMyProfile);

router.put(
  '/update-profile',
  auth(),
  validateRequest(UserValidations.updateProfileSchema),
  UserControllers.updateMyProfile,
);

router.post(
  '/resend-verification-email',
  validateRequest(UserValidations.forgetPasswordSchema),
  UserControllers.resendUserVerificationEmail,
);

router.put('/change-password', auth(), UserControllers.changePassword);

router.post(
  '/forgot-password',
  validateRequest(UserValidations.forgetPasswordSchema),
  UserControllers.forgotPassword,
);

router.post(
  '/resend-otp',
  validateRequest(UserValidations.forgetPasswordSchema),
  UserControllers.resendOtp,
);

router.put(
  '/verify-otp-forgot-password',
  validateRequest(UserValidations.verifyOtpSchema),
  UserControllers.verifyOtpForgotPassword,
);

router.put(
  '/update-password',
  validateRequest(UserValidations.updatePasswordSchema),
  UserControllers.updatePassword,
);

router.post(
  '/social-sign-up',
  validateRequest(UserValidations.socialLoginSchema),
  UserControllers.socialLogin,
);

router.post('/delete-account', auth(), UserControllers.deleteAccount);

router.put(
  '/update-profile-image',
  multerUploadMultiple.single('profileImage'),
  auth(),
  UserControllers.updateProfileImage,
);

export const UserRouters = router;
