import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { adsService } from './ads.service';
import { uploadFileToSpace } from '../../utils/multipleFile';

const createAds = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { files, body } = req;
  const uploads: {
    images: string[];
  } = {
    images: [],
  };
  const fileGroups = files as {
    images?: Express.Multer.File[];
  };
  // Upload images
  if (fileGroups.images?.length) {
    const imageUploads = await Promise.all(
      fileGroups.images.map(file => uploadFileToSpace(file, 'ads-images'))
    );
    uploads.images.push(...imageUploads);
  }
  const adsData = {
    ...body,
    images: uploads.images,
  };

  const result = await adsService.createAdsIntoDb(user.id, adsData);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Ads created successfully',
    data: result,
  });
});

const getAdsList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adsService.getAdsListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Ads list retrieved successfully',
    data: result,
  });
});

const getAdsById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adsService.getAdsByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Ads details retrieved successfully',
    data: result,
  });
});

const updateAds = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { files, body } = req;
  const uploads: {
    images: string[];
  } = {
    images: [],
  };
  const fileGroups = files as {
    images?: Express.Multer.File[];
  };
  // Upload images
  if (fileGroups.images?.length) {
    const imageUploads = await Promise.all(
      fileGroups.images.map(file => uploadFileToSpace(file, 'ads-images'))
    );
    uploads.images.push(...imageUploads);
  }
  const adsData = {
    ...body,
    images: uploads.images,
  };
  const result = await adsService.updateAdsIntoDb(user.id, req.params.id, adsData);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Ads updated successfully',
    data: result,
  });
});

const deleteAds = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adsService.deleteAdsItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Ads deleted successfully',
    data: result,
  });
});

export const adsController = {
  createAds,
  getAdsList,
  getAdsById,
  updateAds,
  deleteAds,
};