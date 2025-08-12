import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { customerService } from './customer.service';

const createCustomer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await customerService.createCustomerIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Customer created successfully',
    data: result,
  });
});

const getAllSaloonList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await customerService.getAllSaloonListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customer list retrieved successfully',
    data: result,
  });
});

const getSaloonAllServicesList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await customerService.getSaloonAllServicesListFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customer list retrieved successfully',
    data: result,
  });
});

const getCustomerById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await customerService.getCustomerByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customer details retrieved successfully',
    data: result,
  });
});

const updateCustomer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await customerService.updateCustomerIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customer updated successfully',
    data: result,
  });
});

const deleteCustomer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await customerService.deleteCustomerItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customer deleted successfully',
    data: result,
  });
});

export const customerController = {
  createCustomer,
  getAllSaloonList,
  getSaloonAllServicesList,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};