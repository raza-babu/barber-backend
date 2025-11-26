import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { reviewService } from './review.service';
import { UserRoleEnum } from '@prisma/client';

const createReview = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await reviewService.createReviewIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Review created successfully',
    data: result,
  });
});

const getReviewListForSaloon = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await reviewService.getReviewListForSaloonFromDb(
    user.id,
    // req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Review list retrieved successfully',
    data: result,
  });
});

const getReviewListForBarber = catchAsync(async (req, res) => {
  const user = req.user as any;
  const userRole = user.role;
  if (userRole === UserRoleEnum.BARBER) {
    const result = await reviewService.getReviewListForBarberFromDb(user.id);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Review list for barber retrieved successfully',
      data: result,
    });
  } else {
    const result = await reviewService.getReviewListForSaloonFromDb(user.id);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Review list for barber retrieved successfully',
      data: result,
    });
  }
});

const getNotProvidedForSaloonList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await reviewService.getNotProvidedReviewsForSaloonFromDb(
    user.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Not provided reviews for saloon retrieved successfully',
    data: result,
  });
});



const getReviewById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await reviewService.getReviewByIdFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Review details retrieved successfully',
    data: result,
  });
});

const updateReview = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await reviewService.updateReviewIntoDb(
    user.id,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Review updated successfully',
    data: result,
  });
});

const deleteReview = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await reviewService.deleteReviewItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Review deleted successfully',
    data: result,
  });
});

export const reviewController = {
  createReview,
  getReviewListForSaloon,
  getReviewListForBarber,
  getNotProvidedForSaloonList,
  getReviewById,
  updateReview,
  deleteReview,
};
