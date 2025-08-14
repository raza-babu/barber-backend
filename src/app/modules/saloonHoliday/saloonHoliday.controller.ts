import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { saloonHolidayService } from './saloonHoliday.service';

const createSaloonHoliday = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonHolidayService.createSaloonHolidayIntoDb(
    user.id, 
    // req.params.saloonId || req.body.saloonId,
    req.body
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Saloon holiday created successfully',
    data: result,
  });
});

const getSaloonHolidayList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonHolidayService.getSaloonHolidayListFromDb(
    user.id,
    // req.params.saloonId,
    // {
    //   fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
    //   toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
    //   isRecurring: req.query.recurring ? req.query.recurring === 'true' : undefined
    // }
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon holidays retrieved successfully',
    data: result,
  });
});

const getSaloonHolidayById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonHolidayService.getSaloonHolidayByIdFromDb(
    user.id,
    req.params.id
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon holiday details retrieved successfully',
    data: result,
  });
});

const updateSaloonHoliday = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonHolidayService.updateSaloonHolidayIntoDb(
    user.id,
    req.params.id,
    req.body
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon holiday updated successfully',
    data: result,
  });
});

const deleteSaloonHoliday = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await saloonHolidayService.deleteSaloonHolidayItemFromDb(
    user.id,
    req.params.id
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon holiday deleted successfully',
    data: result,
  });
});

const checkSaloonHoliday = catchAsync(async (req, res) => {
  const result = await saloonHolidayService.checkSaloonHolidayFromDb(
    req.params.saloonId,
    req.query.date ? new Date(req.query.date as string) : new Date()
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon holiday check completed',
    data: result,
  });
});

export const saloonHolidayController = {
  createSaloonHoliday,
  getSaloonHolidayList,
  getSaloonHolidayById,
  updateSaloonHoliday,
  deleteSaloonHoliday,
  checkSaloonHoliday
};