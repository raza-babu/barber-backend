import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { bookingService } from './booking.service';
import { bookingValidation } from './booking.validation';
import { pickValidFields } from '../../utils/pickValidFields';

const createBooking = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await bookingService.createBookingIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Booking created successfully',
    data: result,
  });
});

const getBookingList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await bookingService.getBookingListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking list retrieved successfully',
    data: result,
  });
});

const getBookingListForSalonOwner = catchAsync(async (req, res) => {
  const user = req.user as any;
  const filters = pickValidFields(req.query, [
      'page',
      'limit',
      'sortBy',
      'sortOrder',
      'searchTerm',
      'startDate',
      'endDate',
      'status',
    ]);
  const result = await bookingService.getBookingListForSalonOwnerFromDb(user.id, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking list for salon owner retrieved successfully',
    data: result,
  });
});

const getAvailableBarbers = catchAsync(async (req, res) => {
  const user = req.user as any;
  const parsed = bookingValidation.availableBarbersSchema.parse({ query: req.query });
  // console.log('Parsed query:', parsed.query);
  const result = await bookingService.getAvailableBarbersFromDb(user.id, parsed.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Available barbers retrieved successfully',
    data: result,
  });
});

const getBookingByIdForSalonOwner = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await bookingService.getBookingByIdFromDbForSalon(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking details for salon owner retrieved successfully',
    data: result,
  });
});

const getBookingById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await bookingService.getBookingByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking details retrieved successfully',
    data: result,
  });
});

const updateBooking = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await bookingService.updateBookingIntoDb(
    user.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking updated successfully',
    data: result,
  });
});

const updateBookingStatus = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await bookingService.updateBookingStatusIntoDb(
    user.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking status updated successfully',
    data: result,
  });
});

const deleteBooking = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await bookingService.deleteBookingItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking deleted successfully',
    data: result,
  });
});

export const bookingController = {
  createBooking,
  getBookingList,
  getBookingListForSalonOwner,
  getBookingByIdForSalonOwner,
  getAvailableBarbers,
  getBookingById,
  updateBooking,
  updateBookingStatus,
  deleteBooking,
};
