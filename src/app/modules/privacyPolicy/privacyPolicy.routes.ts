import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { privacyPolicyController } from './privacyPolicy.controller';
import { privacyPolicyValidation } from './privacyPolicy.validation';
import { UserAccessFunctionName } from '../../utils/access';
import { checkPermissions } from '../../middlewares/checkPermissions';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.SETTINGS,
  ),
  validateRequest(privacyPolicyValidation.createPrivacyPolicySchema),
  privacyPolicyController.createPrivacyPolicy,
);

router.get('/', auth(), privacyPolicyController.getPrivacyPolicyList);

router.get('/:id', auth(), privacyPolicyController.getPrivacyPolicyById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.SETTINGS,
  ),
  validateRequest(privacyPolicyValidation.updatePrivacyPolicySchema),
  privacyPolicyController.updatePrivacyPolicy,
);

router.delete(
  '/:id',
  auth(),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.SETTINGS,
  ),
  privacyPolicyController.deletePrivacyPolicy,
);

export const privacyPolicyRoutes = router;
