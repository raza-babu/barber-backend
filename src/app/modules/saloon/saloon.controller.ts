import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { saloonService } from './saloon.service';
import { pickValidFields } from '../../utils/pickValidFields';
import { saloonValidation } from './saloon.validation';
import { SubscriptionPlanStatus } from '@prisma/client';

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
  const result = await saloonService.getCustomerBookingsFromDb(
    user.id,
    filters,
  );
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
  const saloonId = req.params.id;
  const result = await saloonService.getAllBarbersFromDb(user.id, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Barber list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getRemainingBarbersToSchedule = catchAsync(async (req, res) => {
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
  const result = await saloonService.getRemainingBarbersToScheduleFromDb(
    user.id,
    filters,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Remaining barbers to schedule retrieved successfully',
    data: result,
    // meta: result.meta,
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
  const parsed = saloonValidation.availableBarbersSchema.parse({
    query: req.query,
  });
  const result = await saloonService.getScheduledBarbersFromDb(
    user.id,
    parsed.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Scheduled barbers retrieved successfully',
    data: result,
  });
});

const getFreeBarbersOnADate = catchAsync(async (req, res) => {
  const user = req.user as any;
  const parsed = saloonValidation.availableFreeBarbersSchema.parse({
    query: req.query,
  });
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

  const date = parsed.query.utcDateTime as string;

  const result = await saloonService.getFreeBarbersOnADateFromDb(
    user.id,
    date,
    filters,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Free barbers on the selected date retrieved successfully',
    data: result,
    // meta: result.meta,
  });
});

const getASaloonById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonService.getASaloonByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon details retrieved successfully',
    data: result,
  });
});

const updateSaloonQueueControl = catchAsync(async (req, res) => {
  const user = req.user as any;
  const subscriptionPlanName = user.subscriptionPlan;
  if (
    subscriptionPlanName === SubscriptionPlanStatus.FREE ||
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM
  ) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message:
        'Access denied. Upgrade your subscription to access hired barbers.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.ADVANCED_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
    const result = await saloonService.updateSaloonQueueControlIntoDb(
      user.id,
      req.body,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Saloon queue control updated successfully',
      data: result,
    });
  }
});

const deleteSaloon = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonService.deleteSaloonItemFromDb(
    user.id,
    req.params.id,
  );
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
  getRemainingBarbersToSchedule,
  getFreeBarbersOnADate,
  getASaloonById,
  terminateBarber,
  getScheduledBarbers,
  updateSaloonQueueControl,
  deleteSaloon,
};
