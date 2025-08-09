import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { supportRepliesController } from './supportReplies.controller';
import { supportRepliesValidation } from './supportReplies.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(supportRepliesValidation.createSchema),
  supportRepliesController.createSupportReplies,
);

router.get('/', auth(), supportRepliesController.getSupportRepliesList);

router.get('/:id', auth(), supportRepliesController.getSupportRepliesById);

router.put(
  '/:id',
  auth(),
  validateRequest(supportRepliesValidation.updateSchema),
  supportRepliesController.updateSupportReplies,
);

router.delete('/:id', auth(), supportRepliesController.deleteSupportReplies);

export const supportRepliesRoutes = router;
