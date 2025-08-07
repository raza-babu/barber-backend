import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { jobPostService } from './jobPost.service';

const createJobPost = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await jobPostService.createJobPostIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'JobPost created successfully',
    data: result,
  });
});

const getJobPostList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await jobPostService.getJobPostListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'JobPost list retrieved successfully',
    data: result,
  });
});

const getJobPostById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await jobPostService.getJobPostByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'JobPost details retrieved successfully',
    data: result,
  });
});

const updateJobPost = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await jobPostService.updateJobPostIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'JobPost updated successfully',
    data: result,
  });
});

const toggleJobPostActive = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await jobPostService.toggleJobPostActiveIntoDb(user.id, req.params.jobPostId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'JobPost active status toggled successfully',
    data: result,
  });
});


const deleteJobPost = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await jobPostService.deleteJobPostItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'JobPost deleted successfully',
    data: result,
  });
});

export const jobPostController = {
  createJobPost,
  getJobPostList,
  getJobPostById,
  updateJobPost,
  toggleJobPostActive,
  deleteJobPost,
};