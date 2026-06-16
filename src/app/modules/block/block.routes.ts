import express from 'express';
import { UserRoleEnum } from '@prisma/client';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { blockController } from './block.controller';
import { blockValidation } from './block.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  validateRequest(blockValidation.createBlockSchema),
  blockController.blockUser,
);

router.get(
  '/',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  blockController.getBlockList,
);

router.delete(
  '/:blockedId',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  validateRequest(blockValidation.unblockSchema),
  blockController.unblockUser,
);

export const blockRoutes = router;
