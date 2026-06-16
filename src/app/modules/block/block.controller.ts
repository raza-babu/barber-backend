import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { blockService } from './block.service';

const blockUser = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { blockedId, reason } = req.body;

  const result = await blockService.blockUserIntoDb(user.id, blockedId, reason);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'User blocked successfully',
    data: result,
  });
});

const unblockUser = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { blockedId } = req.params;

  const result = await blockService.unblockUserFromDb(user.id, blockedId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User unblocked successfully',
    data: result,
  });
});

const getBlockList = catchAsync(async (req, res) => {
  const user = req.user as any;

  const result = await blockService.getBlockListFromDb(user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Block list retrieved successfully',
    data: result.data,
  });
});

export const blockController = {
  blockUser,
  unblockUser,
  getBlockList,
};
