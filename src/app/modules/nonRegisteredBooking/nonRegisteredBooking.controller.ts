import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { nonRegisteredBookingService } from './nonRegisteredBooking.service';

const createNonRegisteredBooking = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await nonRegisteredBookingService.createNonRegisteredBookingIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'NonRegisteredBooking created successfully',
    data: result,
  });
});

const getNonRegisteredBookingList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await nonRegisteredBookingService.getNonRegisteredBookingListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'NonRegisteredBooking list retrieved successfully',
    data: result,
  });
});

const getNonRegisteredBookingById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await nonRegisteredBookingService.getNonRegisteredBookingByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'NonRegisteredBooking details retrieved successfully',
    data: result,
  });
});

const updateNonRegisteredBooking = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await nonRegisteredBookingService.updateNonRegisteredBookingIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'NonRegisteredBooking updated successfully',
    data: result,
  });
});

const deleteNonRegisteredBooking = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await nonRegisteredBookingService.deleteNonRegisteredBookingItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'NonRegisteredBooking deleted successfully',
    data: result,
  });
});

export const nonRegisteredBookingController = {
  createNonRegisteredBooking,
  getNonRegisteredBookingList,
  getNonRegisteredBookingById,
  updateNonRegisteredBooking,
  deleteNonRegisteredBooking,
};