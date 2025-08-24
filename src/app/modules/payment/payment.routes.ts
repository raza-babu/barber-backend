import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { paymentController } from './payment.controller';
import { paymentValidation } from './payment.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
'/',
auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.CUSTOMER),
validateRequest(paymentValidation.createSchema),
paymentController.createPayment,
);

router.get('/', auth(), paymentController.getPaymentList);

router.get('/:id', auth(), paymentController.getPaymentById);

router.put(
'/:id',
auth(),
validateRequest(paymentValidation.updateSchema),
paymentController.updatePayment,
);

router.delete('/:id', auth(), paymentController.deletePayment);

export const paymentRoutes = router;