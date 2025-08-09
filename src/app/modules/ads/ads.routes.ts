import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { adsController } from './ads.controller';
import { adsValidation } from './ads.validation';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parse } from 'path';
import { parseBody } from '../../middlewares/parseBody';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.fields([{ name: 'images', maxCount: 5 }]),
  parseBody,
  auth(),
  validateRequest(adsValidation.createAdsSchema),
  adsController.createAds,
);

router.get('/', auth(), adsController.getAdsList);

router.get('/:id', auth(), adsController.getAdsById);

router.put(
  '/:id',
  multerUploadMultiple.fields([{ name: 'images', maxCount: 5 }]),
  parseBody,
  auth(),
  validateRequest(adsValidation.updateAdsSchema),
  adsController.updateAds,
);

router.delete('/:id', auth(), adsController.deleteAds);

export const adsRoutes = router;
