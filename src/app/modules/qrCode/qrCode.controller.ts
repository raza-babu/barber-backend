import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { qrCodeService } from './qrCode.service';

const createQrCode = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await qrCodeService.createQrCodeIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'QrCode created successfully',
    data: result,
  });
});

const getQrCodeList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await qrCodeService.getQrCodeListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'QrCode list retrieved successfully',
    data: result,
  });
});

const getQrCodeById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await qrCodeService.getQrCodeByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'QrCode details retrieved successfully',
    data: result,
  });
});

const updateQrCode = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await qrCodeService.updateQrCodeIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'QrCode updated successfully',
    data: result,
  });
});

const deleteQrCode = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await qrCodeService.deleteQrCodeItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'QrCode deleted successfully',
    data: result,
  });
});

export const qrCodeController = {
  createQrCode,
  getQrCodeList,
  getQrCodeById,
  updateQrCode,
  deleteQrCode,
};