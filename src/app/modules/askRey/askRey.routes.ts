import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { askReyController } from './askRey.controller';
import { askReyValidation } from './askRey.validation';

const router = express.Router();

router.post(
'/',
auth(),
validateRequest(askReyValidation.createSchema),
askReyController.createAskRey,
);

router.get('/', auth(), askReyController.getAskReyList);

router.get('/:id', auth(), askReyController.getAskReyById);

router.put(
'/:id',
auth(),
validateRequest(askReyValidation.updateSchema),
askReyController.updateAskRey,
);

router.delete('/:id', auth(), askReyController.deleteAskRey);

export const askReyRoutes = router;