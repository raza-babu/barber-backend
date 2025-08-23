import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { followController } from './follow.controller';
import { followValidation } from './follow.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  validateRequest(followValidation.createSchema),
  followController.createFollow,
);

router.get(
  '/following',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  followController.getFollowingList,
);

router.get(
  '/followers',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  followController.getFollowerList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  followController.getFollowById,
);

router.put(
  '/:id',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  validateRequest(followValidation.updateSchema),
  followController.updateFollow,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  followController.deleteFollowing,
);

export const followRoutes = router;
