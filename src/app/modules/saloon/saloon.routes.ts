import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { saloonController } from './saloon.controller';
import { saloonValidation } from './saloon.validation';
import { UserRoleEnum } from '@prisma/client';
import checkSubscriptionForSalonOwners from '../../middlewares/checkSubscriptionForSalonOwners';

const router = express.Router();

// router.post(
// '/',
// auth(),
// validateRequest(saloonValidation.createSchema),
// saloonController.createSaloon,
// );

router.patch(
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
  '/booking-history',
  auth(UserRoleEnum.SALOON_OWNER),
  saloonController.getCustomerBookings,
);

router.get(
  '/transactions',
  auth(UserRoleEnum.SALOON_OWNER),
  saloonController.getTransactions,
);

router.get(
  '/barbers',
  auth(UserRoleEnum.SALOON_OWNER),
  saloonController.getAllBarbers,
);

router.get(
  '/remaining-barbers-to-schedule',
  auth(UserRoleEnum.SALOON_OWNER),
  saloonController.getRemainingBarbersToSchedule,
);

router.get(
  '/scheduled-barbers',
  auth(UserRoleEnum.SALOON_OWNER),
  saloonController.getScheduledBarbers,
);

router.get(
  '/free-barbers',
  auth(UserRoleEnum.SALOON_OWNER),
  saloonController.getFreeBarbersOnADate,
)

router.patch(
  '/terminate-barber',
  auth(UserRoleEnum.SALOON_OWNER),
  saloonController.terminateBarber,
);

router.patch(
  '/queue-control',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(saloonValidation.updateQueueSchema),
  saloonController.updateSaloonQueueControl,
);

router.delete('/:id', auth(), saloonController.deleteSaloon);

export const saloonRoutes = router;
