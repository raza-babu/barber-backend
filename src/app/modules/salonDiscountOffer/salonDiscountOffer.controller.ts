import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { salonDiscountOfferService } from './salonDiscountOffer.service';
import { pickValidFields } from '../../utils/pickValidFields';

const createDiscountOffer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await salonDiscountOfferService.createDiscountOfferInDb(
    user.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Discount offer created successfully',
    data: result,
  });
});

const getSalonDiscountOffersForOwner = catchAsync(async (req, res) => {
  const user = req.user as any;
  const options = pickValidFields(req.query, [
    'page',
    'limit',
    'sortBy',
    'sortOrder',
    'searchTerm',
    'isActive',
  ]);

  const result =
    await salonDiscountOfferService.getSalonDiscountOffersForOwnerFromDb(
      user.id,
      options,
    );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Salon discount offers retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getDiscountOfferById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await salonDiscountOfferService.getDiscountOfferByIdFromDb(
    user.id,
    req.params.id,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Discount offer details retrieved successfully',
    data: result,
  });
});

const updateDiscountOffer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await salonDiscountOfferService.updateDiscountOfferInDb(
    user.id,
    req.params.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Discount offer updated successfully',
    data: result,
  });
});

const deleteDiscountOffer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await salonDiscountOfferService.deleteDiscountOfferFromDb(
    user.id,
    req.params.id,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Discount offer deleted successfully',
    data: result,
  });
});

const getActiveOffersForCustomer = catchAsync(async (req, res) => {
  const saloonId = req.params.saloonId;
  const user = req.user as any;
  const result =
    await salonDiscountOfferService.getActiveOffersForCustomerFromDb(
      saloonId,
      user?.id,
    );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Active discount offers retrieved successfully',
    data: result,
  });
});

const validateDiscountOffer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { saloonOwnerId, discountOfferId, code, subtotal } = req.body;

  const result =
    await salonDiscountOfferService.validateDiscountOfferForBooking(
      user.id,
      saloonOwnerId,
      { discountOfferId, code },
      Number(subtotal),
    );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Discount offer validated successfully',
    data: result,
  });
});

export const salonDiscountOfferController = {
  createDiscountOffer,
  getSalonDiscountOffersForOwner,
  getDiscountOfferById,
  updateDiscountOffer,
  deleteDiscountOffer,
  getActiveOffersForCustomer,
  validateDiscountOffer,
};
