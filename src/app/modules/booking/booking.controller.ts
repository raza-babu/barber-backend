import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { bookingService } from './booking.service';
import { bookingValidation } from './booking.validation';

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
  const result = await bookingService.getBookingListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking list retrieved successfully',
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

const getBookingById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await bookingService.getBookingByIdFromDb(req.params.id);
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
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking updated successfully',
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
  getAvailableBarbers,
  getBookingById,
  updateBooking,
  deleteBooking,
};
