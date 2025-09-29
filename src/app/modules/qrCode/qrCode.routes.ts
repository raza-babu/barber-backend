import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { qrCodeController } from './qrCode.controller';
import { qrCodeValidation } from './qrCode.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(qrCodeValidation.createQrCodeSchema),
  qrCodeController.createQrCode,
);

router.get(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  qrCodeController.getQrCodeList,
);

router.get(
  '/verify/:code',
  qrCodeController.verifyQrCode,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  qrCodeController.getQrCodeById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(qrCodeValidation.updateQrCodeSchema),
  qrCodeController.updateQrCode,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  qrCodeController.deleteQrCode,
);

export const qrCodeRoutes = router;
