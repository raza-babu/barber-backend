import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { UserServices } from '../user/user.service';
import AppError from '../../errors/AppError';
import { uploadFileToSpace } from '../../utils/multipleFile';
import { log } from 'node:console';

const registerUser = catchAsync(async (req, res) => {
  const result = await UserServices.registerUserIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'User registered successfully',
    data: result,
  });
});

const resendUserVerificationEmail = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await UserServices.resendUserVerificationEmail(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Verification email sent successfully',
    data: result,
  });
});

const registerSaloonOwner = catchAsync(async (req, res) => {
  const { files, body } = req;

  const uploads: {
    shopLogo?: string;
    shopImages: string[];
    shopVideos: string[];
  } = {
    shopImages: [],
    shopVideos: [],
  };

  const fileGroups = files as {
    shop_logo?: Express.Multer.File[];
    shop_images?: Express.Multer.File[];
    shop_videos?: Express.Multer.File[];
  };

  // Upload shop logo
  if (fileGroups.shop_logo?.[0]) {
    uploads.shopLogo = await uploadFileToSpace(
      fileGroups.shop_logo[0],
      'saloon-logos',
    );
  }

  // Upload shop images
  if (fileGroups.shop_images?.length) {
    const imageUploads = await Promise.all(
      fileGroups.shop_images.map(file =>
        uploadFileToSpace(file, 'saloon-images'),
      ),
    );
    uploads.shopImages.push(...imageUploads);
  }

  // Upload shop videos
  if (fileGroups.shop_videos?.length) {
    const videoUploads = await Promise.all(
      fileGroups.shop_videos.map(file =>
        uploadFileToSpace(file, 'saloon-videos'),
      ),
    );
    uploads.shopVideos.push(...videoUploads);
  }

  const payload = {
    ...body,
    shopLogo: uploads.shopLogo,
    shopImages: uploads.shopImages,
    shopVideo: uploads.shopVideos ? uploads.shopVideos : [],
  };

  const result = await UserServices.registerSaloonOwnerIntoDB(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'Saloon owner profile completed successfully',
    data: result,
  });
});

const updateSaloonOwner = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { files, body } = req;
  const uploads: {
    shopLogo?: string;
    shopImages: string[];
    shopVideos: string[];
  } = {
    shopImages: [],
    shopVideos: [],
  };
  const fileGroups = files as {
    shop_logo?: Express.Multer.File[];
    shop_images?: Express.Multer.File[];
    shop_videos?: Express.Multer.File[];
  } || {};
  // Upload shop logo (optional)
  if (fileGroups.shop_logo?.[0]) {
    uploads.shopLogo = await uploadFileToSpace(
      fileGroups.shop_logo[0],
      'saloon-logos',
    );
  } 
  // Upload shop images (optional)
  if (fileGroups.shop_images?.length) {
    const imageUploads = await Promise.all(
      fileGroups.shop_images.map(file =>
        uploadFileToSpace(file, 'saloon-images'),
      ),
    );
    uploads.shopImages.push(...imageUploads);
  }
  // Upload shop videos (optional)
  if (fileGroups.shop_videos?.length) {
    const videoUploads = await Promise.all(
      fileGroups.shop_videos.map(file =>
        uploadFileToSpace(file, 'saloon-videos'),
      ),
    );
    uploads.shopVideos.push(...videoUploads);
  }

  const payload: Record<string, unknown> = { ...body };

  if (uploads.shopLogo?.length && uploads.shopLogo[0]) {
    // store single logo string (we set uploads.shopLogo[0] on upload)
    payload.shopLogo = uploads.shopLogo[0];
  }

  if (uploads.shopImages?.length) {
    payload.shopImages = uploads.shopImages;
  }

  if (uploads.shopVideos?.length) {
    payload.shopVideo = uploads.shopVideos;
  }
  const result = await UserServices.updateSaloonOwnerIntoDB(user.id, payload);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Saloon owner updated successfully',
    data: result,
  });
});

const updateBarber = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { files, body } = req;

  const uploads: {
    portfolioImages: string[];
  } = {
    portfolioImages: [],
  };

  const fileGroups = files as {
    portfolioImages?: Express.Multer.File[];
  } || {};

  // Upload portfolio images (optional)
  if (fileGroups?.portfolioImages?.length) {
    const uploadedImages = await Promise.all(
      fileGroups.portfolioImages.map(file =>
        uploadFileToSpace(file, 'barber-portfolio'),
      ),
    );
    uploads.portfolioImages.push(...uploadedImages);
  }

  if(uploads.portfolioImages.length) {
    body.portfolio = uploads.portfolioImages;
  }

  const payload = {
    ...body,
  };

  // Update DB
  const result = await UserServices.updateBarberIntoDB(user.id, payload);

  // Send reference images to external AI service.
  // Best practice: perform external API calls from the service layer.
  // Here we call a service function which should build the form-data (images + barber_codes)
  // and POST to http://127.0.0.1:8080/upload_reference.
  // if (uploads.portfolioImages.length) {
  //   await UserServices.sendReferenceImagesToAI(user.id, uploads.portfolioImages);
  // }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'Barber registered successfully (reference images sent to AI)',
    data: result,
  });
});

const getMyProfile = catchAsync(async (req, res) => {
  const user = req.user as any;

  const result = await UserServices.getMyProfileFromDB(user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Profile retrieved successfully',
    data: result,
  });
});

const getSaloonOwnerProfile = catchAsync(async (req, res) => {
  const user = req.user as any;

  const result = await UserServices.getSaloonOwnerProfileFromDB(user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Saloon owner profile retrieved successfully',
    data: result,
  });
});

const getBarberProfile = catchAsync(async (req, res) => {
  const user = req.user as any;

  const result = await UserServices.getBarberProfileFromDB(user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Barber profile retrieved successfully',
    data: result,
  });
});

const updateMyProfile = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await UserServices.updateMyProfileIntoDB(user.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User profile updated successfully',
    data: result,
  });
});

const changePassword = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await UserServices.changePassword(user, user.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Password changed successfully',
    data: result,
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const result = await UserServices.forgotPassword(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Please check your email to get the otp!',
    data: result,
  });
});

const resendOtp = catchAsync(async (req, res) => {
  const result = await UserServices.resendOtpIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'OTP sent successfully!',
    data: result,
  });
});

const verifyOtp = catchAsync(async (req, res) => {
  const result = await UserServices.verifyOtpInDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'OTP verified successfully!',
    data: result,
  });
});

const verifyOtpForgotPassword = catchAsync(async (req, res) => {
  const result = await UserServices.verifyOtpForgotPasswordInDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'OTP verified successfully!',
    data: result,
  });
});

const socialLogin = catchAsync(async (req, res) => {
  const result = await UserServices.socialLoginIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User logged in successfully',
    data: result,
  });
});

const updatePassword = catchAsync(async (req, res) => {
  const result = await UserServices.updatePasswordIntoDb(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

const deleteAccount = catchAsync(async (req, res) => {
  const user = req.user as any;
  await UserServices.deleteAccountFromDB(user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    data: null,
    message: 'Account deleted successfully',
  });
});

const updateProfileImage = catchAsync(async (req, res) => {
  const user = req.user as { id: string };
  const file = req.file;

  if (!file) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Profile image file is required.',
    );
  }

  // Upload to DigitalOcean
  const fileUrl = await uploadFileToSpace(file, 'user-profile-images');

  // Update DB
  const result = await UserServices.updateProfileImageIntoDB(user.id, fileUrl);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Profile image updated successfully',
    data: result,
  });
});

export const UserControllers = {
  registerUser,
  registerSaloonOwner,
  updateSaloonOwner,
  updateBarber,
  getMyProfile,
  getSaloonOwnerProfile,
  getBarberProfile,
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
  updateProfileImage,
};
