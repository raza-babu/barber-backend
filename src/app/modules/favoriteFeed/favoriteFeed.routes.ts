import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { favoriteFeedController } from './favoriteFeed.controller';
import { favoriteFeedValidation } from './favoriteFeed.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
//   validateRequest(favoriteFeedValidation.createSchema),
  favoriteFeedController.createFavoriteFeed,
);

router.get('/', auth(), favoriteFeedController.getFavoriteFeedList);

router.get('/:id', auth(), favoriteFeedController.getFavoriteFeedById);

router.put(
  '/:id',
  auth(),
//   validateRequest(favoriteFeedValidation.updateSchema),
  favoriteFeedController.updateFavoriteFeed,
);

router.delete('/:id', auth(), favoriteFeedController.deleteFavoriteFeed);

export const favoriteFeedRoutes = router;
