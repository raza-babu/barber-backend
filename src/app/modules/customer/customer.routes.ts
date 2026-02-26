import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { customerController } from './customer.controller';
import { customerValidation } from './customer.validation';
import { UserRoleEnum } from '@prisma/client';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parseBody } from '../../middlewares/parseBody';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(customerValidation.createSchema),
  customerController.createCustomer,
);

router.post(
  '/analyze-saloon',
  multerUploadMultiple.single('image'),
  parseBody,
  auth(UserRoleEnum.CUSTOMER),
  validateRequest(customerValidation.analyzeSaloonSchema),
  customerController.analyzeSaloonFromImage,
)

router.get(
  '/all-saloons',
  auth(UserRoleEnum.CUSTOMER),
  customerController.getAllSaloonList,
);

router.get(
  '/nearest-saloons',
  auth(UserRoleEnum.CUSTOMER),
  customerController.getMyNearestSaloonList,
);

router.get(
  '/top-rated-saloons',
  auth(UserRoleEnum.CUSTOMER),
  customerController.getTopRatedSaloons,
);

router.post(
  '/favorite-saloons',
  auth(UserRoleEnum.CUSTOMER),
  customerController.addSaloonToFavorites,
)

router.get(
  '/favorite-saloons',
  auth(UserRoleEnum.CUSTOMER),
  customerController.getFavoriteSaloons,
)

router.delete(
  '/favorite-saloons/:saloonId',
  auth(UserRoleEnum.CUSTOMER),
  customerController.removeSaloonFromFavorites,
)

router.get(
  '/saloon-services/:id',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.SALOON_OWNER),
  customerController.getSaloonAllServicesList,
);

router.get(
  '/visited-saloons',
  auth(UserRoleEnum.CUSTOMER),
  customerController.getVisitedSaloonList,
)

router.get(
  '/my-loyalty-offers/:id',
  auth(UserRoleEnum.CUSTOMER),
  customerController.getMyLoyaltyOffers,
)

router.get('/:id', auth(), customerController.getCustomerById);

router.put(
  '/:id',
  auth(),
  validateRequest(customerValidation.updateSchema),
  customerController.updateCustomer,
);

router.delete('/:id', auth(), customerController.deleteCustomer);

export const customerRoutes = router;
