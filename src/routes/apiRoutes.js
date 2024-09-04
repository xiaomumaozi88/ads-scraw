// src/routes/apiRoutes.js
import { Router } from 'express';
import * as scraperController from '../controllers/scraperController.js';
import * as authController from '../controllers/authController.js';
import * as statusController from '../controllers/statusController.js';
import * as verifyController from '../controllers/verifyController.js';
import * as loginController from '../controllers/loginController.js';
import * as clearLoginController from '../controllers/clearLoginController.js';

const router = Router();

router.post('/orderById', scraperController.scrape);
router.post('/check-login', authController.checkLogin);
router.get('/status', statusController.getStatus);
router.post('/verify_code', verifyController.verify);
router.post('/login', loginController.login);
router.post('/clearLogin', clearLoginController.clearLogin);

export default router;
