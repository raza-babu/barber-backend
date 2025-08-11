import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { adminController } from './admin.controller';
import { adminValidation } from './admin.validation';

const router = express.Router();

router.post(
'/',
auth(),
validateRequest(adminValidation.createSchema),
adminController.createAdmin,
);

router.get('/', auth(), adminController.getAdminList);

router.get('/:id', auth(), adminController.getAdminById);

router.put(
'/:id',
auth(),
validateRequest(adminValidation.updateSchema),
adminController.updateAdmin,
);

router.delete('/:id', auth(), adminController.deleteAdmin);

export const adminRoutes = router;