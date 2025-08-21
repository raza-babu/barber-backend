import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { adsController } from './ads.controller';
import { adsValidation } from './ads.validation';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parse } from 'path';
import { parseBody } from '../../middlewares/parseBody';
import { checkPermissions } from '../../middlewares/checkPermissions';
import { UserAccessFunctionName } from '../../utils/access';
import { UserRoleEnum } from '@prisma/client';
const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.fields([{ name: 'images', maxCount: 5 }]),
  parseBody,
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ADS_PROMOTIONS,
    UserAccessFunctionName.ALL,
  ),
  validateRequest(adsValidation.createAdsSchema),
  adsController.createAds,
);

router.get(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN, UserRoleEnum.CUSTOMER),
  checkPermissions(
    UserAccessFunctionName.ADS_PROMOTIONS,
    UserAccessFunctionName.ALL,
  ),
  adsController.getAdsList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN, UserRoleEnum.CUSTOMER),
  checkPermissions(
    UserAccessFunctionName.ADS_PROMOTIONS,
    UserAccessFunctionName.ALL,
  ),
  adsController.getAdsById,
);

router.patch(
  '/:id',
  multerUploadMultiple.fields([{ name: 'images', maxCount: 5 }]),
  parseBody,
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ADS_PROMOTIONS,
    UserAccessFunctionName.ALL,
  ),
  validateRequest(adsValidation.updateAdsSchema),
  adsController.updateAds,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  checkPermissions(
    UserAccessFunctionName.ADS_PROMOTIONS,
    UserAccessFunctionName.ALL,
  ),
  adsController.deleteAds,
);

export const adsRoutes = router;
