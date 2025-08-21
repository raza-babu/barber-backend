import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { feedController } from './feed.controller';
import { feedValidation } from './feed.validation';
import multer from 'multer';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parseBody } from '../../middlewares/parseBody';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.fields([{ name: 'images', maxCount: 5 }]),
  parseBody,
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  validateRequest(feedValidation.createFeedSchema),
  feedController.createFeed,
);

router.get('/', auth(), feedController.getFeedList);

router.get('/:id', auth(), feedController.getFeedById);

router.patch(
  '/:id',
  multerUploadMultiple.fields([{ name: 'images', maxCount: 5 }]),
  parseBody,
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  validateRequest(feedValidation.updateFeedSchema),
  feedController.updateFeed,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  feedController.deleteFeed,
);

export const feedRoutes = router;
