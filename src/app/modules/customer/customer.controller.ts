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

const analyzeSaloonFromImage = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await customerService.analyzeSaloonFromImageInDb(
    user.id,
    req.file,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon analyzed successfully',
    data: result,
  });
});

const getAllSaloonList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { searchTerm, page, limit, sortBy, minRating, latitude, longitude, radius, topRated } = req.query;

  // If latitude and longitude are provided, get nearest saloons
  if (latitude && longitude && !topRated) {
    const query = {
      radius: radius ? Number(radius) : undefined,
      searchTerm: searchTerm as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      minRating: minRating ? Number(minRating) : undefined,
    };

    const result = await customerService.getMyNearestSaloonListFromDb(
      user.id,
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
  if (topRated && !(latitude || longitude)) {
    const query = {
      searchTerm: searchTerm as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      minRating: minRating ? Number(minRating) : undefined,
    };

    const result = await customerService.getTopRatedSaloonsFromDb(user.id, query);

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

  const result = await customerService.getAllSaloonListFromDb(user.id, query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getMyNearestSaloonList = catchAsync(async (req, res) => {
  const user = req.user as any;
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
    user.id,
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
  const user = req.user as any;
  const { searchTerm, page, limit, minRating } = req.query;

  const query = {
    searchTerm: searchTerm as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    minRating: minRating ? Number(minRating) : undefined,
  };

  const result = await customerService.getTopRatedSaloonsFromDb(user.id, query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Top rated saloons retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const addSaloonToFavorites = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await customerService.addSaloonToFavoritesInDb(
    user.id,
    req.body.saloonId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon added to favorites successfully',
    data: result,
  });
});

const getFavoriteSaloons = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { page, limit } = req.query;

  const query = {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  };

  const result = await customerService.getFavoriteSaloonsFromDb(user.id, query);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Favorite saloons retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});
const removeSaloonFromFavorites = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await customerService.removeSaloonFromFavoritesInDb(
    user.id,
    req.params.saloonId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saloon removed from favorites successfully',
    data: result,
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

const getVisitedSaloonList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { page, limit } = req.query;

  const query = {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  };

  const result = await customerService.getVisitedSaloonListFromDb(user.id, query);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Visited saloons retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getMyLoyaltyOffers = catchAsync(async (req, res) => {
  const user = req.user as any;

  const result = await customerService.getMyLoyaltyOffersFromDb(user.id, req.params.id);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Loyalty offers retrieved successfully',
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
  analyzeSaloonFromImage,
  getAllSaloonList,
  getMyNearestSaloonList,
  getTopRatedSaloons,
  getSaloonAllServicesList,
  getVisitedSaloonList,
  getMyLoyaltyOffers,
  addSaloonToFavorites,
  getFavoriteSaloons,
  removeSaloonFromFavorites,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};
