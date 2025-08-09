import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { faqController } from './faq.controller';
import { faqValidation } from './faq.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(faqValidation.createFaqSchema),
  faqController.createFaq,
);

router.get('/', auth(), faqController.getFaqList);

router.get('/:id', auth(), faqController.getFaqById);

router.put(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(faqValidation.updateFaqSchema),
  faqController.updateFaq,
);

router.delete('/:id', auth(), faqController.deleteFaq);

export const faqRoutes = router;
