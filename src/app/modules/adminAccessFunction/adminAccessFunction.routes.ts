import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { adminAccessFunctionController } from './adminAccessFunction.controller';
import { adminAccessFunctionValidation } from './adminAccessFunction.validation';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parseBody } from '../../middlewares/parseBody';
import { checkPermissions } from '../../middlewares/checkPermissions';
import { UserAccessFunctionName } from '../../utils/access';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.single('profileImage'),
  parseBody,
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.ADMIN_MANAGEMENT,
  ),
  validateRequest(adminAccessFunctionValidation.createSchema),
  adminAccessFunctionController.createAdminAccessFunction,
);

router.get(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.ADMIN_MANAGEMENT,
  ),
  adminAccessFunctionController.getAdminAccessFunctionList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.ADMIN_MANAGEMENT,
  ),
  adminAccessFunctionController.getAdminAccessFunctionById,
);

router.put(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.ADMIN_MANAGEMENT,
  ),
  validateRequest(adminAccessFunctionValidation.updateSchema),
  adminAccessFunctionController.updateAdminAccessFunction,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.ADMIN_MANAGEMENT,
  ),
  adminAccessFunctionController.deleteAdminAccessFunction,
);

export const adminAccessFunctionRoutes = router;
