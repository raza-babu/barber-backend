import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { adminAccessFunctionService } from './adminAccessFunction.service';
import { uploadFileToSpace } from '../../utils/multipleFile';
import AppError from '../../errors/AppError';

const createAdminAccessFunction = catchAsync(async (req, res) => {
  const user = req.user as any;
  const {file, body} = req;
  
  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Profile image file is required.');
  }

  // Upload to DigitalOcean
  const fileUrl = await uploadFileToSpace(file, 'admin-profile-images');
  const accessFunctionData = {
    ...body,
    image: fileUrl,
  };

  const result = await adminAccessFunctionService.createAdminAccessFunctionIntoDb(user.id, accessFunctionData);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'AdminAccessFunction created successfully',
    data: result,
  });
});

const getAdminAccessFunctionList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminAccessFunctionService.getAdminAccessFunctionListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AdminAccessFunction list retrieved successfully',
    data: result,
  });
});

const getAdminAccessFunctionById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminAccessFunctionService.getAdminAccessFunctionByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AdminAccessFunction details retrieved successfully',
    data: result,
  });
});

const updateAdminAccessFunction = catchAsync(async (req, res) => {
  const user = req.user as any;
 
  const result = await adminAccessFunctionService.updateAdminAccessFunctionIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AdminAccessFunction updated successfully',
    data: result,
  });
});

const deleteAdminAccessFunction = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminAccessFunctionService.deleteAdminAccessFunctionItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AdminAccessFunction deleted successfully',
    data: result,
  });
});

export const adminAccessFunctionController = {
  createAdminAccessFunction,
  getAdminAccessFunctionList,
  getAdminAccessFunctionById,
  updateAdminAccessFunction,
  deleteAdminAccessFunction,
};