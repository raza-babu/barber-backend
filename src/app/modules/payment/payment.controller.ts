import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { paymentService } from './payment.service';

const createPayment = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await paymentService.createPaymentIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Payment created successfully',
    data: result,
  });
});

const getPaymentList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await paymentService.getPaymentListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment list retrieved successfully',
    data: result,
  });
});

const getPaymentById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await paymentService.getPaymentByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment details retrieved successfully',
    data: result,
  });
});

const updatePayment = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await paymentService.updatePaymentIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment updated successfully',
    data: result,
  });
});

const deletePayment = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await paymentService.deletePaymentItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment deleted successfully',
    data: result,
  });
});

export const paymentController = {
  createPayment,
  getPaymentList,
  getPaymentById,
  updatePayment,
  deletePayment,
};