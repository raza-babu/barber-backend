import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { adminController } from './admin.controller';
import { adminValidation } from './admin.validation';
import { UserRoleEnum } from '@prisma/client';
import { checkPermissions } from '../../middlewares/checkPermissions';
import { UserAccessFunctionName } from '../../utils/access';

const router = express.Router();

router.get(
  '/dashboard',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.ADMIN_MANAGEMENT,
  ),
  //   validateRequest(adminValidation.createSchema),
  adminController.getAdminDashboard,
);

router.get(
  '/saloons',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.SALOON_OWNER,
  ),
  adminController.getSaloonList,
);

router.patch(
  '/block-saloon/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.SALOON_OWNER,
  ),
  validateRequest(adminValidation.blockSchema),
  adminController.blockSaloonById,
);

router.get(
  '/barbers',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.BARBER_MANAGEMENT,
  ),
  adminController.getBarbersList,
);
router.patch(
  '/block-barber/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.BARBER_MANAGEMENT,
  ),
  validateRequest(adminValidation.blockSchema),
  adminController.blockBarberById,
);

router.get(
  '/customers',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.CUSTOMER,
  ),
  adminController.getCustomersList,
);

router.patch(
  '/block-customer/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.CUSTOMER,
  ),
  validateRequest(adminValidation.blockSchema),
  adminController.blockCustomerById,
);

router.patch(
  '/verify-saloon-owner/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ALL || UserAccessFunctionName.SALOON_OWNER,
  ),
  validateRequest(adminValidation.updateSchema),
  adminController.updateSaloonOwnerById,
);


export const adminRoutes = router;
