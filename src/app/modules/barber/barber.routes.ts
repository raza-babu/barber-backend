import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { barberController } from './barber.controller';
import { barberValidation } from './barber.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(barberValidation.createSchema),
  barberController.createBarber,
);

router.get('/', auth(), barberController.getBarberList);

router.get(
  '/dashboard',
  auth(UserRoleEnum.SALOON_OWNER),
  barberController.getBarberDashboard,
)

router.get(
  '/bookings',
  auth(UserRoleEnum.SALOON_OWNER),
  barberController.getCustomerBookings,
);

router.get('/:id', auth(), barberController.getBarberById);



router.put(
  '/:id',
  auth(),
  validateRequest(barberValidation.updateSchema),
  barberController.updateBarber,
);

router.delete('/:id', auth(), barberController.deleteBarber);

export const barberRoutes = router;
