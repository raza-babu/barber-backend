import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { customerController } from './customer.controller';
import { customerValidation } from './customer.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(customerValidation.createSchema),
  customerController.createCustomer,
);

router.get(
  '/all-saloons',
  auth(UserRoleEnum.CUSTOMER),
  customerController.getAllSaloonList,
);

router.get(
  '/saloon-services/:id',
  auth(UserRoleEnum.CUSTOMER),
  customerController.getSaloonAllServicesList,
);

router.get('/:id', auth(), customerController.getCustomerById);

router.put(
  '/:id',
  auth(),
  validateRequest(customerValidation.updateSchema),
  customerController.updateCustomer,
);

router.delete('/:id', auth(), customerController.deleteCustomer);

export const customerRoutes = router;
