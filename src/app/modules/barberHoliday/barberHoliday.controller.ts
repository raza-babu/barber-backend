import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { barberHolidayService } from './barberHoliday.service';

const createBarberHoliday = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberHolidayService.createBarberHolidayIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'BarberHoliday created successfully',
    data: result,
  });
});

const getBarberHolidayList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberHolidayService.getBarberHolidayListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'BarberHoliday list retrieved successfully',
    data: result,
  });
});

const getBarberHolidayById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberHolidayService.getBarberHolidayByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'BarberHoliday details retrieved successfully',
    data: result,
  });
});

const updateBarberHoliday = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberHolidayService.updateBarberHolidayIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'BarberHoliday updated successfully',
    data: result,
  });
});

const deleteBarberHoliday = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberHolidayService.deleteBarberHolidayItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'BarberHoliday deleted successfully',
    data: result,
  });
});

export const barberHolidayController = {
  createBarberHoliday,
  getBarberHolidayList,
  getBarberHolidayById,
  updateBarberHoliday,
  deleteBarberHoliday,
};