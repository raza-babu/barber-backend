import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { serviceController } from './service.controller';
import { serviceValidation } from './service.validation';

const router = express.Router();

router.post(
'/',
auth(),
validateRequest(serviceValidation.createServiceSchema),
serviceController.createService,
);

router.get('/', auth(), serviceController.getServiceList);

router.get('/:id', auth(), serviceController.getServiceById);

router.patch(
'/:id',
auth(),
validateRequest(serviceValidation.updateServiceSchema),
serviceController.updateService,
);

router.patch(
    '/:serviceId/active',
    auth(),
    validateRequest(serviceValidation.toggleServiceActiveSchema),
    serviceController.toggleServiceActive,
);

router.delete('/:id', auth(), serviceController.deleteService);

export const ServiceRoutes = router;