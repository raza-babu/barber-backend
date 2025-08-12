import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { jobApplicationsService } from './jobApplications.service';
import { pickValidFields } from '../../utils/pickValidFields';

const createJobApplications = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await jobApplicationsService.createJobApplicationsIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'JobApplications created successfully',
    data: result,
  });
});

const getJobApplicationsList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const filters = pickValidFields(req.query, [
    'page',
    'limit',
    'sortBy',
    'sortOrder',
    'searchTerm',
    'status',
    'jobPostId',
    'startDate',
    'endDate',
  ]);
  
  const result = await jobApplicationsService.getJobApplicationsListFromDb(user.id, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'JobApplications list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getJobApplicationsById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await jobApplicationsService.getJobApplicationsByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'JobApplications details retrieved successfully',
    data: result,
  });
});

const getHiredBarbersList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const filters = pickValidFields(req.query, [
    'page',
    'limit',
    'sortBy',
    'sortOrder',
    'searchTerm',
    'startDate',
    'endDate',
  ]);
  
  const result = await jobApplicationsService.getHiredBarbersListFromDb(user.id, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Hired Barbers list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const updateJobApplications = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await jobApplicationsService.updateJobApplicationsIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'JobApplications updated successfully',
    data: result,
  });
});

const deleteJobApplications = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await jobApplicationsService.deleteJobApplicationsItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'JobApplications deleted successfully',
    data: result,
  });
});

export const jobApplicationsController = {
  createJobApplications,
  getJobApplicationsList,
  getJobApplicationsById,
  getHiredBarbersList,
  updateJobApplications,
  deleteJobApplications,
};