import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { barberService } from './barber.service';

const createBarber = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberService.createBarberIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Barber created successfully',
    data: result,
  });
});

const getBarberDashboard = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberService.getBarberDashboardFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Barber dashboard data retrieved successfully',
    data: result,
  });
});

const getCustomerBookings = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberService.getCustomerBookingsFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customer bookings retrieved successfully',
    data: result,
  });
});

const getBarberList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberService.getBarberListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Barber list retrieved successfully',
    data: result,
  });
});

const getBarberById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberService.getBarberByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Barber details retrieved successfully',
    data: result,
  });
});

const updateBarber = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberService.updateBarberIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Barber updated successfully',
    data: result,
  });
});

const deleteBarber = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberService.deleteBarberItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Barber deleted successfully',
    data: result,
  });
});

export const barberController = {
  createBarber,
  getBarberDashboard,
  getCustomerBookings,
  getBarberList,
  getBarberById,
  updateBarber,
  deleteBarber,
};