import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { favoriteFeedController } from './favoriteFeed.controller';
import { favoriteFeedValidation } from './favoriteFeed.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  //   validateRequest(favoriteFeedValidation.createSchema),
  favoriteFeedController.createFavoriteFeed,
);

router.get(
  '/',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  favoriteFeedController.getFavoriteFeedList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  favoriteFeedController.getFavoriteFeedById,
);

router.put(
  '/:id',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  //   validateRequest(favoriteFeedValidation.updateSchema),
  favoriteFeedController.updateFavoriteFeed,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  favoriteFeedController.deleteFavoriteFeed,
);

export const favoriteFeedRoutes = router;
