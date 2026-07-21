// src/routes/apiRoutes.js
import { Router } from 'express';
import { iamAuthMiddleware } from '../middleware/iamAuth.js';
import { actionGuardMiddleware } from '../middleware/actionGuard.js';
import iamRoutes from './iamRoutes.js';
import * as securityController from '../controllers/securityController.js';
import * as healthController from '../controllers/healthController.js';
import * as operationAuditController from '../controllers/operationAuditController.js';
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
import * as externalSearchController from '../controllers/externalSearchController.js';
import * as externalSearchDebugController from '../controllers/externalSearchDebugController.js';
import * as proxyMediaController from '../controllers/proxyMediaController.js';
import * as transcodeVideoController from '../controllers/transcodeVideoController.js';
import * as materialAuditController from '../controllers/materialAuditController.js';
import * as guangdadaCnAdInfoController from '../controllers/guangdadaCnAdInfoController.js';
// Sensor Tower
import * as loginControllerSensorTower from '../controllers/loginControllerSensorTower.js';
import * as statusControllerSensorTower from '../controllers/statusControllerSensorTower.js';
import * as clearLoginControllerSensorTower from '../controllers/clearLoginControllerSensorTower.js';
import * as searchControllerSensorTower from '../controllers/searchControllerSensorTower.js';

const router = Router();
const GUANGDADA_API_PREFIX = '/catalog/g1';
const GUANGDADA_CN_API_PREFIX = '/catalog/g1-cn';

router.use(iamAuthMiddleware);

router.use('/iam', iamRoutes);
router.get('/security/action-token', securityController.getActionToken);
router.use(actionGuardMiddleware);

router.get('/health', healthController.getHealth);
router.get('/health/platform-credentials', healthController.getPlatformCredentials);
router.put('/health/platform-credentials/:platform', healthController.putPlatformCredentials);
router.get('/health/operation-audits', operationAuditController.getOperationAudits);
router.get('/health/operation-audits/summary', operationAuditController.getOperationAuditSummary);
router.get('/proxy-media', proxyMediaController.getProxyMedia);
router.post('/transcode-video', transcodeVideoController.transcodeVideo);
router.get('/transcode-queue', transcodeVideoController.getTranscodeQueue);
router.get('/transcode-jobs', transcodeVideoController.listTranscodeJobs);
router.get('/transcode-jobs/:id', transcodeVideoController.getTranscodeJobById);
router.get('/transcode-jobs/:id/download', transcodeVideoController.downloadTranscodeJob);
router.get('/download-image', proxyMediaController.getDownloadImage);
router.post('/material-processing/batch-audit', materialAuditController.postMaterialBatchAudit);
router.post('/health/clear-logs', healthController.postClearLogs);
router.post('/health/reopen-browser', healthController.postReopenBrowser);
router.post('/health/restart-container', healthController.postRestartContainer);

// Insightrackr 网站路由
router.post('/insightrackr/login', loginControllerInsightrackr.login);
router.get('/insightrackr/auto-login-info', loginControllerInsightrackr.getAutoLoginInfo);
router.post('/insightrackr/trigger-login', loginControllerInsightrackr.postTriggerLogin);
router.get('/insightrackr/status', statusControllerInsightrackr.getStatus);
router.post('/insightrackr/clearLogin', clearLoginControllerInsightrackr.clearLogin);
router.post('/insightrackr/search', searchControllerInsightrackr.search);
router.post('/insightrackr/search-global', searchControllerInsightrackr.searchGlobal);
router.post('/insightrackr/count', searchControllerInsightrackr.count);
router.post('/insightrackr/distribute/media', searchControllerInsightrackr.distributeMedia);
router.post('/insightrackr/distribute/app', searchControllerInsightrackr.distributeApp);
router.post('/insightrackr/distribute/adfaction', searchControllerInsightrackr.distributeAdfaction);

// 广大大网站路由
router.post(`${GUANGDADA_API_PREFIX}/login`, loginControllerGuangdada.login);
router.get(`${GUANGDADA_API_PREFIX}/status`, statusControllerGuangdada.getStatus);
router.get(`${GUANGDADA_API_PREFIX}/auto-login-info`, loginControllerGuangdada.getAutoLoginInfo);
router.post(`${GUANGDADA_API_PREFIX}/trigger-login`, loginControllerGuangdada.postTriggerLogin);
router.post(`${GUANGDADA_API_PREFIX}/clearLogin`, clearLoginControllerGuangdada.clearLogin);
router.get(`${GUANGDADA_API_PREFIX}/quota-status`, searchControllerGuangdada.quotaStatus);
router.post(`${GUANGDADA_API_PREFIX}/quota-consume`, searchControllerGuangdada.consumeQuota);
router.post(`${GUANGDADA_API_PREFIX}/search`, searchControllerGuangdada.search);
router.post(`${GUANGDADA_API_PREFIX}/count`, searchControllerGuangdada.count);
router.post(`${GUANGDADA_API_PREFIX}/multi-modal-search`, searchControllerGuangdada.multiModalSearch);
router.get(`${GUANGDADA_API_PREFIX}/advertiser-association`, searchControllerGuangdada.advertiserAssociation);
router.post(`${GUANGDADA_API_PREFIX}/advertiser-association`, searchControllerGuangdada.advertiserAssociation);
router.get(`${GUANGDADA_API_PREFIX}/ai-tags-v2`, searchControllerGuangdada.aiTagsV2);
router.post(`${GUANGDADA_API_PREFIX}/creative-rank/list`, searchControllerGuangdada.creativeRankList);
router.get(`${GUANGDADA_API_PREFIX}/hidden-info`, searchControllerGuangdada.hiddenInfo);
router.get(`${GUANGDADA_API_PREFIX}/creative-detail`, searchControllerGuangdada.creativeDetail);
router.post(`${GUANGDADA_API_PREFIX}/creative-detail`, searchControllerGuangdada.creativeDetail);
router.get(`${GUANGDADA_API_PREFIX}/related-dynamic`, searchControllerGuangdada.relatedDynamic);
router.get(`${GUANGDADA_API_PREFIX}/rank-status`, searchControllerGuangdada.rankStatus);
router.get(`${GUANGDADA_API_PREFIX}/material-script-analysis`, searchControllerGuangdada.materialScriptAnalysis);
router.post(`${GUANGDADA_API_PREFIX}/translate`, searchControllerGuangdada.translateText);
router.get(`${GUANGDADA_API_PREFIX}/daily-popularity`, searchControllerGuangdada.dailyPopularity);
router.post(`${GUANGDADA_API_PREFIX}/daily-popularity`, searchControllerGuangdada.dailyPopularity);
router.post(`${GUANGDADA_API_PREFIX}/related-advertisers`, searchControllerGuangdada.relatedAdvertisers);
router.post(`${GUANGDADA_API_PREFIX}/related-ads`, searchControllerGuangdada.relatedAds);
router.get(`${GUANGDADA_API_PREFIX}/advertiser-detail`, searchControllerGuangdada.advertiserDetail);
router.post(`${GUANGDADA_API_PREFIX}/adv-rec-list`, searchControllerGuangdada.advRecList);
router.post(`${GUANGDADA_API_PREFIX}/similar-ads`, searchControllerGuangdada.similarAds);

// Sensor Tower
router.post('/sensortower/login', loginControllerSensorTower.login);
router.get('/sensortower/status', statusControllerSensorTower.getStatus);
router.get('/sensortower/auto-login-info', loginControllerSensorTower.getAutoLoginInfo);
router.post('/sensortower/trigger-login', loginControllerSensorTower.postTriggerLogin);
router.post('/sensortower/clearLogin', clearLoginControllerSensorTower.clearLogin);
router.post('/sensortower/search', searchControllerSensorTower.search);

// 外部聚合调用（独立接口）
router.post('/external/insightrackr/top50', externalSearchController.externalInsightrackrTop50);
router.get('/external/insightrackr/top50', externalSearchController.externalInsightrackrTop50);
router.post('/external/g1/top50', externalSearchController.externalGuangdadaTop50);
router.get('/external/g1/top50', externalSearchController.externalGuangdadaTop50);

/** 临时：外部查询调试日志（生产默认关闭，见 EXTERNAL_SEARCH_DEBUG） */
router.get('/external/debug-log', externalSearchDebugController.getExternalSearchDebugLog);
router.post('/external/debug-log/clear', externalSearchDebugController.postClearExternalSearchDebugLog);

// 广大大国内版（BBA）广告列表代理
router.get(`${GUANGDADA_CN_API_PREFIX}/ad-info`, guangdadaCnAdInfoController.getGuangdadaCnAdInfo);

export default router;
