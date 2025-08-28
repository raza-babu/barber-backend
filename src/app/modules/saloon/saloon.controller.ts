import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { saloonService } from './saloon.service';
import { pickValidFields } from '../../utils/pickValidFields';

const manageBookings = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonService.manageBookingsIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Bookings managed successfully',
    data: result,
  });
});

const getBarberDashboard = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonService.getBarberDashboardFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Barber dashboard data retrieved successfully',
    data: result,
  });
});

const getCustomerBookings = catchAsync(async (req, res) => {
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
  const result = await saloonService.getCustomerBookingsFromDb(user.id, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customer bookings retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getTransactions = catchAsync(async (req, res) => {
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
  const result = await saloonService.getTransactionsFromDb(user.id, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Transactions retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getAllBarbers = catchAsync(async (req, res) => {
  const user = req.user as any;
  const filters = pickValidFields(req.query, [
    'page',
    'limit',
    'sortBy',
    'sortOrder',
    'searchTerm',
    'status',
    'startDate',
    'endDate',
  ]);
  const saloonId = req.params.id 
  const result = await saloonService.getAllBarbersFromDb(user.id, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Barber list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const terminateBarber = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonService.terminateBarberIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Barber terminated successfully',
    data: result,
  });
});

const getScheduledBarbers = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonService.getScheduledBarbersFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Scheduled barbers retrieved successfully',
    data: result,
  }); 
});

const deleteSaloon = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonService.deleteSaloonItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon deleted successfully',
    data: result,
  });
});

export const saloonController = {
  manageBookings,
  getBarberDashboard,
  getTransactions,
  getCustomerBookings,
  getAllBarbers,
  terminateBarber,
  getScheduledBarbers,
  deleteSaloon,
};