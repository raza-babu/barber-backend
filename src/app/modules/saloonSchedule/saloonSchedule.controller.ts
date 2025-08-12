import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { saloonScheduleService } from './saloonSchedule.service';

const createSaloonSchedule = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonScheduleService.createSaloonScheduleIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'SaloonSchedule created successfully',
    data: result,
  });
});

const getSaloonScheduleList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonScheduleService.getSaloonScheduleListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SaloonSchedule list retrieved successfully',
    data: result,
  });
});

const getSaloonScheduleById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonScheduleService.getSaloonScheduleByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SaloonSchedule details retrieved successfully',
    data: result,
  });
});

const updateSaloonSchedule = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonScheduleService.updateSaloonScheduleIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SaloonSchedule updated successfully',
    data: result,
  });
});

const deleteSaloonSchedule = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonScheduleService.deleteSaloonScheduleItemFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SaloonSchedule deleted successfully',
    data: result,
  });
});

export const saloonScheduleController = {
  createSaloonSchedule,
  getSaloonScheduleList,
  getSaloonScheduleById,
  updateSaloonSchedule,
  deleteSaloonSchedule,
};