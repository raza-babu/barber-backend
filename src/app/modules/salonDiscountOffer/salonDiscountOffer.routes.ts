import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { UserRoleEnum } from '@prisma/client';
import checkSubscriptionForSalonOwners from '../../middlewares/checkSubscriptionForSalonOwners';
import { salonDiscountOfferController } from './salonDiscountOffer.controller';
import { salonDiscountOfferValidation } from './salonDiscountOffer.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(salonDiscountOfferValidation.createDiscountOfferSchema),
  salonDiscountOfferController.createDiscountOffer,
);

router.get(
  '/owner',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  salonDiscountOfferController.getSalonDiscountOffersForOwner,
);

router.get(
  '/saloon/:saloonId',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  salonDiscountOfferController.getActiveOffersForCustomer,
);

router.post(
  '/validate',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER),
  validateRequest(salonDiscountOfferValidation.validateDiscountOfferSchema),
  salonDiscountOfferController.validateDiscountOffer,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN),
  salonDiscountOfferController.getDiscountOfferById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(salonDiscountOfferValidation.updateDiscountOfferSchema),
  salonDiscountOfferController.updateDiscountOffer,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  salonDiscountOfferController.deleteDiscountOffer,
);

export const salonDiscountOfferRoutes = router;
