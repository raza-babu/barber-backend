import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { supportRepliesController } from './supportReplies.controller';
import { supportRepliesValidation } from './supportReplies.validation';
import { UserRoleEnum } from '@prisma/client';
import { checkPermissions } from '../../middlewares/checkPermissions';
import { UserAccessFunctionName } from '../../utils/access';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.CUSTOMER),
  validateRequest(supportRepliesValidation.createSchema),
  supportRepliesController.createSupportReplies,
);

router.get(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.SUPPORT,
  ),
  supportRepliesController.getSupportRepliesList,
);
router.patch(
  '/replies/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.SUPPORT,
  ),
  validateRequest(supportRepliesValidation.updateSchema),
  supportRepliesController.updateSupportReplies,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.SUPPORT,
  ),
  supportRepliesController.getSupportRepliesById,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.SUPPORT,
  ),
  supportRepliesController.deleteSupportReplies,
);

export const supportRepliesRoutes = router;
