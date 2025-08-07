import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { jobApplicationsController } from './jobApplications.controller';
import { jobApplicationsValidation } from './jobApplications.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.BARBER),
  validateRequest(jobApplicationsValidation.createJobApplicationSchema),
  jobApplicationsController.createJobApplications,
);

router.get(
  '/',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  jobApplicationsController.getJobApplicationsList,
);

router.get(
  '/hired-barbers',
  auth(UserRoleEnum.SALOON_OWNER),
  jobApplicationsController.getHiredBarbersList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  jobApplicationsController.getJobApplicationsById,
);


router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  validateRequest(jobApplicationsValidation.updateJobApplicationSchema),
  jobApplicationsController.updateJobApplications,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  jobApplicationsController.deleteJobApplications,
);

export const jobApplicationsRoutes = router;
