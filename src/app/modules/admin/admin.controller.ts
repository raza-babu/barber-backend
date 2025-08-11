import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { adminService } from './admin.service';

const getSaloonList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getSaloonFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin created successfully',
    data: result,
  });
});

const blockSaloonById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.blockSaloonByIdIntoDb(req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin list retrieved successfully',
    data: result,
  });
});

const getBarbersList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getBarbersListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin details retrieved successfully',
    data: result,
  });
});

const blockBarberById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.blockBarberByIdIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin updated successfully',
    data: result,
  });
});

const getCustomersList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getCustomersListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customers list retrieved successfully',
    data: result,
  });
});

const blockCustomerById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.blockCustomerByIdIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customer blocked successfully',
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
    message: 'Admin deleted successfully',
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