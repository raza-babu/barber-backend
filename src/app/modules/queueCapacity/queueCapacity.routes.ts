import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { queueCapacityController } from './queueCapacity.controller';
import { queueCapacityValidation } from './queueCapacity.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(queueCapacityValidation.createSchema),
  queueCapacityController.createQueueCapacity,
);

router.get('/', auth(), queueCapacityController.getQueueCapacityList);

router.get('/:id', auth(), queueCapacityController.getQueueCapacityById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(queueCapacityValidation.updateSchema),
  queueCapacityController.updateQueueCapacity,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  queueCapacityController.deleteQueueCapacity,
);

export const queueCapacityRoutes = router;
