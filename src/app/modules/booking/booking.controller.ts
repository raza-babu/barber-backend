import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { bookingService } from './booking.service';
import { bookingValidation } from './booking.validation';
import { pickValidFields } from '../../utils/pickValidFields';
import { BookingType, ScheduleType, User, UserRoleEnum } from '@prisma/client';
import AppError from '../../errors/AppError';

const createBooking = catchAsync(async (req, res) => {
  const user = req.user as any;
  if(req.body.bookingType === undefined){
    throw new AppError(httpStatus.BAD_REQUEST, 'Booking type is required');
  }
  console.log('Booking Type:', req.body.bookingType);
  if (req.body.bookingType === BookingType.QUEUE) {
    const result = await bookingService.createQueueBookingIntoDb(user.id, req.body);
    return sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: 'Queue booking created successfully',
      data: result,
    });
  }
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
    'appointmentAt',
    'date',
  ]);
  const result = await bookingService.getBookingListForSalonOwnerFromDb(
    user.id,
    filters,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking list for salon owner retrieved successfully',
    data: result.data, 
    meta: result.meta, 
  });
});

const getAvailableBarbers = catchAsync(async (req, res) => {
  const user = req.user as any;
  const parsed = bookingValidation.availableBarbersSchema.parse({
    query: req.query,
  });
  // console.log('Parsed query:', parsed.query);
  const result = await bookingService.getAvailableBarbersFromDb(
    user.id,
    parsed.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Available barbers retrieved successfully',
    data: result,
  });
});

const getAvailableBarbersForWalkingIn = catchAsync(async (req, res) => {
  const user = req.user as any;
  const saloonId = req.params.saloonId;
  const type = req.params.type as ScheduleType;
  if(type !== ScheduleType.BOOKING && type !== ScheduleType.QUEUE){
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid schedule type. It must be either BOOKING or QUEUE.');
  }
  const date = req.query.date as string;
  const result = await bookingService.getAllBarbersForQueueFromDb(
    user.id,
    saloonId,
    type,
    date,
    user.role as UserRoleEnum,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Available barbers for walking-in retrieved successfully',
    data: result,
  });
});

const getAvailableABarberForWalkingIn = catchAsync(async (req, res) => {
  const user = req.user as any;
  const saloonId = req.params.saloonId ;
  const barberId = req.params.barberId ;
  const date = req.query.date as string;
  const result = await bookingService.getAvailableABarberForWalkingInFromDb(
    user.id,
    saloonId,
    barberId,
    date,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Available barber for walking-in retrieved successfully',
    data: result,
  });
});

const getBookingByIdForSalonOwner = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await bookingService.getBookingByIdFromDbForSalon(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking details for salon owner retrieved successfully',
    data: result,
  });
});

const getBookingById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await bookingService.getBookingByIdFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking details retrieved successfully',
    data: result,
  });
});

const updateBooking = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await bookingService.updateBookingIntoDb(user.id, req.body);
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

const cancelBooking = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await bookingService.cancelBookingIntoDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking cancelled successfully',
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

const getLoyaltySchemesForACustomer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await bookingService.getLoyaltySchemesForCustomerFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Loyalty schemes retrieved successfully',
    data: result,
  });
});

export const bookingController = {
  createBooking,
  getBookingList,
  getBookingListForSalonOwner,
  getBookingByIdForSalonOwner,
  getAvailableBarbersForWalkingIn,
  getAvailableABarberForWalkingIn,
  getAvailableBarbers,
  getBookingById,
  updateBooking,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
  getLoyaltySchemesForACustomer,
};
