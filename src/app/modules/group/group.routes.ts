import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { groupController } from './group.controller';
import { groupValidation } from './group.validation';
import { multerUpload } from '../../utils/multerUpload';
import { parseBody } from '../../middlewares/parseBody';
import { updateMulterUpload } from '../../utils/updateMulterUpload';

const router = express.Router();

router.post(
  '/',
  multerUpload.single('groupImage'),
  parseBody,
  validateRequest(groupValidation.createSchema),
  auth(),
  groupController.createGroup,
);

router.get('/', auth(), groupController.getGroupList);

router.post(
  '/image-to-link',
  multerUpload.single('chatImage'),
  auth(),
  groupController.imageToLink,
);

router.get('/:groupId', auth(), groupController.getGroupById);

router.put(
  '/:groupId',
  updateMulterUpload.single('groupImage'),
  parseBody,
  validateRequest(groupValidation.updateSchema),
  auth(),
  groupController.updateGroup,
);

router.delete('/:groupId', auth(), groupController.deleteGroup);

export const groupRoutes = router;
