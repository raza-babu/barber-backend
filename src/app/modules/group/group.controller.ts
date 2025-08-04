import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { groupService } from './group.service';
import AppError from '../../errors/AppError';
import { uploadFileToSpace } from '../../utils/multerUpload';
import { uploadFileToSpaceForUpdate } from '../../utils/updateMulterUpload';

const createGroup = catchAsync(async (req, res) => {
  const user = req.user as any;
  const data = req.body;
  const file = req.file;

  if (!file) {
    throw new AppError(httpStatus.CONFLICT, 'file not found');
  }
  const fileUrl = await uploadFileToSpace(file, 'retire-professional');

  const groupData = {
    data,
    groupImage: fileUrl,
  };
  const result = await groupService.createGroupIntoDb(user.id, groupData);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Group created successfully',
    data: result,
  });
});

const getGroupList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await groupService.getGroupListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Group list retrieved successfully',
    data: result,
  });
});

const getGroupById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await groupService.getGroupByIdFromDb(req.params.groupId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Group details retrieved successfully',
    data: result,
  });
});

const updateGroup = catchAsync(async (req, res) => {
  const groupId = req.params.groupId;
  const user = req.user as any;
  const data = req.body;
  const file = req.file;

  let groupData: { data: any; groupImage?: string } = { data };

  if (file) {
    const fileUrl = await uploadFileToSpaceForUpdate(
      file,
      'retire-professional',
    );
    groupData.groupImage = fileUrl;
  }
  const result = await groupService.updateGroupIntoDb(
    user.id,
    groupId,
    groupData,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Group updated successfully',
    data: result,
  });
});

const deleteGroup = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await groupService.deleteGroupItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Group deleted successfully',
    data: result,
  });
});

const imageToLink = catchAsync(async (req, res) => {
  const file = req.file;

  if (!file) {
    throw new AppError(httpStatus.CONFLICT, 'file not found');
  }
  const fileUrl = await uploadFileToSpace(file, 'retire-professional');

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Image Link Created successfully',
    data: fileUrl,
  });
});

export const groupController = {
  createGroup,
  getGroupList,
  getGroupById,
  updateGroup,
  deleteGroup,
  imageToLink,
};
