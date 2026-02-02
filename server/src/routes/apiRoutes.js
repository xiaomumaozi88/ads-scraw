// src/routes/apiRoutes.js
import { Router } from 'express';
import * as healthController from '../controllers/healthController.js';
// Insightrackr 相关控制器
import * as loginControllerInsightrackr from '../controllers/loginControllerInsightrackr.js';
import * as statusControllerInsightrackr from '../controllers/statusControllerInsightrackr.js';
import * as clearLoginControllerInsightrackr from '../controllers/clearLoginControllerInsightrackr.js';
import * as searchControllerInsightrackr from '../controllers/searchControllerInsightrackr.js';
// 广大大相关控制器
import * as loginControllerGuangdada from '../controllers/loginControllerGuangdada.js';
import * as statusControllerGuangdada from '../controllers/statusControllerGuangdada.js';
import * as clearLoginControllerGuangdada from '../controllers/clearLoginControllerGuangdada.js';
import * as searchControllerGuangdada from '../controllers/searchControllerGuangdada.js';

const router = Router();

router.get('/health', healthController.getHealth);

// Insightrackr 网站路由
router.post('/insightrackr/login', loginControllerInsightrackr.login);
router.get('/insightrackr/status', statusControllerInsightrackr.getStatus);
router.post('/insightrackr/clearLogin', clearLoginControllerInsightrackr.clearLogin);
router.post('/insightrackr/search', searchControllerInsightrackr.search);
router.post('/insightrackr/count', searchControllerInsightrackr.count);
router.post('/insightrackr/distribute/media', searchControllerInsightrackr.distributeMedia);
router.post('/insightrackr/distribute/app', searchControllerInsightrackr.distributeApp);

// 广大大网站路由
router.post('/guangdada/login', loginControllerGuangdada.login);
router.get('/guangdada/status', statusControllerGuangdada.getStatus);
router.post('/guangdada/clearLogin', clearLoginControllerGuangdada.clearLogin);
router.post('/guangdada/search', searchControllerGuangdada.search);
router.post('/guangdada/count', searchControllerGuangdada.count);

export default router;
