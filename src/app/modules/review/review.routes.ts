import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { reviewController } from './review.controller';
import { reviewValidation } from './review.validation';
import { UserRoleEnum } from '@prisma/client';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parseBody } from '../../middlewares/parseBody';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.fields([{ name: 'reviewImages', maxCount: 5 }]),
  parseBody,
  auth(UserRoleEnum.CUSTOMER),
  validateRequest(reviewValidation.createReviewSchema),
  reviewController.createReview,
);

router.get(
  '/',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER, UserRoleEnum.CUSTOMER),
  reviewController.getReviewListForBarber,
);

router.get(
  '/not-provided-reviews',
  auth(UserRoleEnum.CUSTOMER),
  reviewController.getNotProvidedForSaloonList,
);

router.get('/saloon/:id', auth(), reviewController.getReviewListForSaloon);

router.patch(
  '/:id',
  auth(UserRoleEnum.CUSTOMER),
  validateRequest(reviewValidation.updateReviewSchema),
  reviewController.updateReview,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  reviewController.deleteReview,
);

export const reviewRoutes = router;
