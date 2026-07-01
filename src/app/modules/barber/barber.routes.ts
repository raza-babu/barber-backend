import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { barberController } from './barber.controller';
import { barberValidation } from './barber.validation';
import { UserRoleEnum } from '@prisma/client';
import { UserAccessFunctionName } from '../../utils/access';
import { checkPermissions } from '../../middlewares/checkPermissions';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(barberValidation.createSchema),
  barberController.createBarber,
);

router.get('/', auth(), barberController.getBarberList);
router.get(
  '/owner-list',
  auth(UserRoleEnum.BARBER),
  barberController.getSaloonOwnerList,
);

router.get(
  '/my-schedule',
  auth(UserRoleEnum.BARBER),
  barberController.getMySchedule,
);

router.get(
  '/my-bookings',
  auth(UserRoleEnum.BARBER),
  barberController.getMyBookings,
);

router.get(
  '/saloons',
  auth(UserRoleEnum.BARBER),
  // checkPermissions(
  //   UserAccessFunctionName.ALL || UserAccessFunctionName.SALOON_OWNER,
  // ),
  barberController.getSaloonList,
);

router.get('/:id', auth(), barberController.getBarberById);

router.patch(
  '/update-booking-status/:id',
  auth(UserRoleEnum.BARBER),
  validateRequest(barberValidation.updateBookingStatusSchema),
  barberController.updateBookingStatus,
);

router.put(
  '/:id',
  auth(),
  validateRequest(barberValidation.updateSchema),
  barberController.updateBarber,
);

router.delete('/:id', auth(), barberController.deleteBarber);

export const barberRoutes = router;
