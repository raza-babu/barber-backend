import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { jobPostController } from './jobPost.controller';
import { jobPostValidation } from './jobPost.validation';
import { parseBody } from '../../middlewares/parseBody';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
'/',
// multerUploadMultiple.fields([
//   { name: 'shop_logo', maxCount: 1 },
// ]),
// parseBody,
auth(),
validateRequest(jobPostValidation.createJobPostSchema),
jobPostController.createJobPost,
);

router.get('/', auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER), jobPostController.getJobPostList);

router.get('/:id', auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN, UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER), jobPostController.getJobPostById);

router.patch(
'/:id',
// multerUploadMultiple.fields([
//   { name: 'shop_logo', maxCount: 1 },
// ]),
// parseBody,
auth(UserRoleEnum.SALOON_OWNER),  
validateRequest(jobPostValidation.updateJobPostSchema),
jobPostController.updateJobPost,
);

router.patch(
  '/:jobPostId/active',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN, UserRoleEnum.SALOON_OWNER),
  jobPostController.toggleJobPostActive,
);

router.delete('/:id', auth(), jobPostController.deleteJobPost);

export const jobPostRoutes = router;