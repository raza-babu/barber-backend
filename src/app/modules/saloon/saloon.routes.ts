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
  checkSubscriptionForSalonOwners(),
  validateRequest(saloonValidation.createSchema),
  saloonController.manageBookings,
);
router.get(
  '/dashboard',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  saloonController.getBarberDashboard,
);

router.get(
  '/booking-history',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  saloonController.getCustomerBookings,
);

router.get(
  '/transactions',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  saloonController.getTransactions,
);

router.get(
  '/barbers',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  saloonController.getAllBarbers,
);

router.get(
  '/remaining-barbers-to-schedule',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  saloonController.getRemainingBarbersToSchedule,
);

router.get(
  '/scheduled-barbers',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  saloonController.getScheduledBarbers,
);

router.get(
  '/free-barbers',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  saloonController.getFreeBarbersOnADate,
);

router.get(
  '/all-saloons/:id',
  auth(UserRoleEnum.CUSTOMER, UserRoleEnum.BARBER, UserRoleEnum.SALOON_OWNER),
  saloonController.getASaloonById,
);

router.patch(
  '/terminate-barber',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  saloonController.terminateBarber,
);

router.patch(
  '/queue-control',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  // validateRequest(saloonValidation.updateQueueSchema),
  saloonController.updateSaloonQueueControl,
);

router.delete('/:id', auth(), saloonController.deleteSaloon);

export const saloonRoutes = router;
