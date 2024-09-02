// src/routes/apiRoutes.js
import { Router } from 'express';
import * as scraperController from '../controllers/scraperController.js';
import * as authController from '../controllers/authController.js';

const router = Router();

router.post('/scrape', scraperController.scrape);
router.post('/check-login', authController.checkLogin);

export default router;
