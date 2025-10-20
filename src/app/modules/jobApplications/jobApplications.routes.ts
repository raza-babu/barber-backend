import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { jobApplicationsController } from './jobApplications.controller';
import { jobApplicationsValidation } from './jobApplications.validation';
import { UserRoleEnum } from '@prisma/client';
import checkSubscriptionForSalonOwners from '../../middlewares/checkSubscriptionForSalonOwners';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.BARBER),
  validateRequest(jobApplicationsValidation.createJobApplicationSchema),
  jobApplicationsController.createJobApplications,
);

router.get(
  '/',
  auth(UserRoleEnum.BARBER),
  checkSubscriptionForSalonOwners(),
  jobApplicationsController.getJobApplicationsList,
);

router.get(
  '/my-applications',
  auth(UserRoleEnum.BARBER),
  jobApplicationsController.getMyJobApplicationsList,
);

router.get(
  '/hired-barbers',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  jobApplicationsController.getHiredBarbersList,
);

router.get(
  '/my-applications/:id',
  auth(UserRoleEnum.BARBER),
  jobApplicationsController.getMyJobApplicationsById,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER),
  checkSubscriptionForSalonOwners(),
  jobApplicationsController.getJobApplicationsById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  validateRequest(jobApplicationsValidation.updateJobApplicationSchema),
  jobApplicationsController.updateJobApplications,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SALOON_OWNER),
  checkSubscriptionForSalonOwners(),
  jobApplicationsController.deleteJobApplications,
);

export const jobApplicationsRoutes = router;
