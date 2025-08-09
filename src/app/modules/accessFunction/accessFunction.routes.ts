import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { accessFunctionController } from './accessFunction.controller';
import { accessFunctionValidation } from './accessFunction.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(accessFunctionValidation.createSchema),
  accessFunctionController.createAccessFunction,
);

router.get('/', auth(), accessFunctionController.getAccessFunctionList);

router.get('/:id', auth(), accessFunctionController.getAccessFunctionById);

router.put(
  '/:id',
  auth(),
  validateRequest(accessFunctionValidation.updateSchema),
  accessFunctionController.updateAccessFunction,
);

router.delete('/:id', auth(), accessFunctionController.deleteAccessFunction);

export const accessFunctionRoutes = router;
