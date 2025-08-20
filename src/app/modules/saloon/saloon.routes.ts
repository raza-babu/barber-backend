import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { saloonController } from './saloon.controller';
import { saloonValidation } from './saloon.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

// router.post(
// '/',
// auth(),
// validateRequest(saloonValidation.createSchema),
// saloonController.createSaloon,
// );

router.post(
  '/manage-bookings',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(saloonValidation.createSchema),
  saloonController.manageBookings,
);
router.get(
  '/dashboard',
  auth(UserRoleEnum.SALOON_OWNER),
  saloonController.getBarberDashboard,
);

router.get(
  '/bookings',
  auth(UserRoleEnum.SALOON_OWNER),
  saloonController.getCustomerBookings,
);

router.get('/:id', auth(), saloonController.getSaloonById);

router.put(
'/:id',
auth(),
validateRequest(saloonValidation.updateSchema),
saloonController.updateSaloon,
);

router.delete('/:id', auth(), saloonController.deleteSaloon);

export const saloonRoutes = router;