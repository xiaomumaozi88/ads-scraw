// src/routes/apiRoutes.js
import { Router } from 'express';
import * as scraperController from '../controllers/scraperController.js';
import * as statusController from '../controllers/statusController.js';
import * as verifyController from '../controllers/verifyController.js';
import * as loginController from '../controllers/loginController.js';
import * as clearLoginController from '../controllers/clearLoginController.js';
import * as verifyImgCodeController from '../controllers/verifyImgCodeController.js';
import * as refreshImgCodeController from '../controllers/refreshImgCodeController.js';

const router = Router();

router.post('/orderById', scraperController.scrape);
router.get('/status', statusController.getStatus);
router.post('/verify_code', verifyController.verify);
router.post('/login', loginController.login);
router.post('/clearLogin', clearLoginController.clearLogin);
router.post('/verifyImgCode', verifyImgCodeController.verifyImgCodeFn)
router.post('/refreshImgCode', refreshImgCodeController.refreshImgCodeFn)

export default router;
