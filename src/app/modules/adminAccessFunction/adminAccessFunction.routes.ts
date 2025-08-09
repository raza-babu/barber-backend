import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { adminAccessFunctionController } from './adminAccessFunction.controller';
import { adminAccessFunctionValidation } from './adminAccessFunction.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN),
  validateRequest(adminAccessFunctionValidation.createSchema),
  adminAccessFunctionController.createAdminAccessFunction,
);

router.get(
  '/',
  auth(),
  adminAccessFunctionController.getAdminAccessFunctionList,
);

router.get(
  '/:id',
  auth(),
  adminAccessFunctionController.getAdminAccessFunctionById,
);

router.put(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN),
  validateRequest(adminAccessFunctionValidation.updateSchema),
  adminAccessFunctionController.updateAdminAccessFunction,
);

router.delete(
  '/:id',
  auth(),
  adminAccessFunctionController.deleteAdminAccessFunction,
);

export const adminAccessFunctionRoutes = router;
