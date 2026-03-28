import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { serviceController } from './service.controller';
import { serviceValidation } from './service.validation';
import { UserRoleEnum } from '@prisma/client';
import checkSubscriptionForSalonOwners from '../../middlewares/checkSubscriptionForSalonOwners';
import { checkSaloonOwnerPaymentReadiness } from '../../middlewares/checkPaymentReadiness';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  checkSaloonOwnerPaymentReadiness(),
  validateRequest(serviceValidation.createServiceSchema),
  serviceController.createService,
);

router.get('/', auth(), serviceController.getServiceList);

router.get('/:id', auth(), serviceController.getServiceById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  checkSaloonOwnerPaymentReadiness(),
  validateRequest(serviceValidation.updateServiceSchema),
  serviceController.updateService,
);

router.patch(
  '/:serviceId/active',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  checkSaloonOwnerPaymentReadiness(),
  validateRequest(serviceValidation.toggleServiceActiveSchema),
  serviceController.toggleServiceActive,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  checkSaloonOwnerPaymentReadiness(),
  serviceController.deleteService,
);

export const ServiceRoutes = router;
