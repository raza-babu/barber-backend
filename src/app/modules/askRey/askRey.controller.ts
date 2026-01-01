import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { askReyService } from './askRey.service';

const createAskRey = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await askReyService.createAskReyIntoDb(user.id,
    req.file as Express.Multer.File,
     req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'AskRey created successfully',
    data: result,
  });
});

const getAskReyList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await askReyService.getAskReyListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AskRey list retrieved successfully',
    data: result,
  });
});

const getAskReyById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await askReyService.getAskReyByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AskRey details retrieved successfully',
    data: result,
  });
});

const updateAskRey = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await askReyService.updateAskReyIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AskRey updated successfully',
    data: result,
  });
});

const deleteAskRey = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await askReyService.deleteAskReyItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AskRey deleted successfully',
    data: result,
  });
});

export const askReyController = {
  createAskRey,
  getAskReyList,
  getAskReyById,
  updateAskRey,
  deleteAskRey,
};