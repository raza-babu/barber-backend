import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { accessFunctionService } from './accessFunction.service';

const createAccessFunction = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await accessFunctionService.createAccessFunctionIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'AccessFunction created successfully',
    data: result,
  });
});

const getAccessFunctionList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await accessFunctionService.getAccessFunctionListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AccessFunction list retrieved successfully',
    data: result,
  });
});

const getAccessFunctionById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await accessFunctionService.getAccessFunctionByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AccessFunction details retrieved successfully',
    data: result,
  });
});

const updateAccessFunction = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await accessFunctionService.updateAccessFunctionIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AccessFunction updated successfully',
    data: result,
  });
});

const deleteAccessFunction = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await accessFunctionService.deleteAccessFunctionItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AccessFunction deleted successfully',
    data: result,
  });
});

export const accessFunctionController = {
  createAccessFunction,
  getAccessFunctionList,
  getAccessFunctionById,
  updateAccessFunction,
  deleteAccessFunction,
};