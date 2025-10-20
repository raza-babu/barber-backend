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

const getMySchedule = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberService.getMyScheduleFromDb(user.id, req.params.dayName);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'BarberSchedule details retrieved successfully',
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
  getMySchedule,
  getBarberList,
  getBarberById,
  updateBarber,
  deleteBarber,
};