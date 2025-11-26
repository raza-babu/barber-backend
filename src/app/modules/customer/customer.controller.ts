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
  const { searchTerm, page, limit, sortBy, minRating, latitude, longitude, radius, topRated } = req.query;

  // If latitude and longitude are provided, get nearest saloons
  if (latitude && longitude) {
    const query = {
      radius: radius ? Number(radius) : undefined,
      searchTerm: searchTerm as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      minRating: minRating ? Number(minRating) : undefined,
    };

    const result = await customerService.getMyNearestSaloonListFromDb(
      Number(latitude),
      Number(longitude),
      query,
    );

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Nearby saloons retrieved successfully',
      data: result.data,
      meta: result.meta,
    });
  }

  // If topRated is true, get top rated saloons
  if (topRated === 'true') {
    const query = {
      searchTerm: searchTerm as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      minRating: minRating ? Number(minRating) : undefined,
    };

    const result = await customerService.getTopRatedSaloonsFromDb(query);

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Top rated saloons retrieved successfully',
      data: result.data,
      meta: result.meta,
    });
  }

  // Default: get all saloons
  const query = {
    searchTerm: searchTerm as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    sortBy: sortBy as 'name' | 'rating' | 'newest',
    minRating: minRating ? Number(minRating) : undefined,
  };

  const result = await customerService.getAllSaloonListFromDb(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getMyNearestSaloonList = catchAsync(async (req, res) => {
  const { latitude, longitude, radius, searchTerm, page, limit, minRating } =
    req.query;

  const query = {
    radius: radius ? Number(radius) : undefined,
    searchTerm: searchTerm as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    minRating: minRating ? Number(minRating) : undefined,
  };

  const result = await customerService.getMyNearestSaloonListFromDb(
    Number(latitude),
    Number(longitude),
    query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Nearby saloons retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getTopRatedSaloons = catchAsync(async (req, res) => {
  const { searchTerm, page, limit, minRating } = req.query;

  const query = {
    searchTerm: searchTerm as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    minRating: minRating ? Number(minRating) : undefined,
  };

  const result = await customerService.getTopRatedSaloonsFromDb(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Top rated saloons retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getSaloonAllServicesList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await customerService.getSaloonAllServicesListFromDb(
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon services retrieved successfully',
    data: result,
  });
});

const getCustomerById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await customerService.getCustomerByIdFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customer details retrieved successfully',
    data: result,
  });
});

const updateCustomer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await customerService.updateCustomerIntoDb(
    user.id,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customer updated successfully',
    data: result,
  });
});

const deleteCustomer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await customerService.deleteCustomerItemFromDb(
    user.id,
    req.params.id,
  );
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
  getMyNearestSaloonList,
  getTopRatedSaloons,
  getSaloonAllServicesList,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};
