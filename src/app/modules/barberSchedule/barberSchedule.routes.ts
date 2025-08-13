import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { barberScheduleController } from './barberSchedule.controller';
import { barberScheduleValidation } from './barberSchedule.validation';

const router = express.Router();

router.post(
'/',
auth(),
validateRequest(barberScheduleValidation.createSchema),
barberScheduleController.createBarberSchedule,
);

router.get('/', auth(), barberScheduleController.getBarberScheduleList);

router.get('/:id', auth(), barberScheduleController.getBarberScheduleById);

router.put(
'/:id',
auth(),
validateRequest(barberScheduleValidation.updateSchema),
barberScheduleController.updateBarberSchedule,
);

router.delete('/:id', auth(), barberScheduleController.deleteBarberSchedule);

export const barberScheduleRoutes = router;