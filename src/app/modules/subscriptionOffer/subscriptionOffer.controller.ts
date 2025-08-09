import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { subscriptionOfferService } from './subscriptionOffer.service';

const createSubscriptionOffer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await subscriptionOfferService.createSubscriptionOfferIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'SubscriptionOffer created successfully',
    data: result,
  });
});

const getSubscriptionOfferList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await subscriptionOfferService.getSubscriptionOfferListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SubscriptionOffer list retrieved successfully',
    data: result,
  });
});

const getSubscriptionOfferById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await subscriptionOfferService.getSubscriptionOfferByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SubscriptionOffer details retrieved successfully',
    data: result,
  });
});

const updateSubscriptionOffer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await subscriptionOfferService.updateSubscriptionOfferIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SubscriptionOffer updated successfully',
    data: result,
  });
});

const deleteSubscriptionOffer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await subscriptionOfferService.deleteSubscriptionOfferItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SubscriptionOffer deleted successfully',
    data: result,
  });
});

export const subscriptionOfferController = {
  createSubscriptionOffer,
  getSubscriptionOfferList,
  getSubscriptionOfferById,
  updateSubscriptionOffer,
  deleteSubscriptionOffer,
};