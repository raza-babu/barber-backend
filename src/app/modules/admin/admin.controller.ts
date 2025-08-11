import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { adminService } from './admin.service';
import { pickValidFields } from '../../utils/pickValidFields';

const getSaloonList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const filters = pickValidFields(req.query, [
    'page',
    'limit',
    'sortBy',
    'sortOrder',
    'searchTerm',
    'status',
    'isVerified',
    'startDate',
    'endDate',
  ]);
  
  const result = await adminService.getSaloonFromDb(user.id, filters);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const blockSaloonById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.blockSaloonByIdIntoDb(req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon status updated successfully',
    data: result,
  });
});

const getBarbersList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const filters = pickValidFields(req.query, [
    'page',
    'limit',
    'sortBy',
    'sortOrder',
    'searchTerm',
    'status',
    'experienceYears',
    'startDate',
    'endDate',
  ]);
  
  const result = await adminService.getBarbersListFromDb(filters);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Barbers list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const blockBarberById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.blockBarberByIdIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Barber status updated successfully',
    data: result,
  });
});

const getCustomersList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const filters = pickValidFields(req.query, [
    'page',
    'limit',
    'sortBy',
    'sortOrder',
    'searchTerm',
    'status',
    'startDate',
    'endDate',
  ]);
  
  const result = await adminService.getCustomersListFromDb(user.id, filters);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customers list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const blockCustomerById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.blockCustomerByIdIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customer status updated successfully',
    data: result,
  });
});

const updateSaloonOwnerById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.updateSaloonOwnerByIdIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon owner updated successfully',
    data: result,
  });
});

const getAdminDashboard = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getAdminDashboardFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin dashboard data retrieved successfully',
    data: result,
  });
});

export const adminController = {
  getSaloonList,
  blockSaloonById,
  getBarbersList,
  blockBarberById,
  getCustomersList,
  blockCustomerById,
  updateSaloonOwnerById,
  getAdminDashboard,
};