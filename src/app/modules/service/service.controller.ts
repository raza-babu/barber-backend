import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { serviceService } from './service.service';

const createService = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await serviceService.createServiceIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Service created successfully',
    data: result,
  });
});

const getServiceList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await serviceService.getServiceListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Service list retrieved successfully',
    data: result,
  });
});

const getServiceById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await serviceService.getServiceByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Service details retrieved successfully',
    data: result,
  });
});

const updateService = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await serviceService.updateServiceIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Service updated successfully',
    data: result,
  });
});

const toggleServiceActive = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await serviceService.toggleServiceActiveIntoDb(user.id, req.params.serviceId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Service active status toggled successfully',
    data: result,
  });
});

const deleteService = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await serviceService.deleteServiceItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Service deleted successfully',
    data: result,
  });
});

export const serviceController = {
  createService,
  getServiceList,
  getServiceById,
  updateService,
  toggleServiceActive,
  deleteService,
};