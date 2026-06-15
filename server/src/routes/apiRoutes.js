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
import * as externalSearchController from '../controllers/externalSearchController.js';
import * as externalSearchDebugController from '../controllers/externalSearchDebugController.js';
import * as proxyMediaController from '../controllers/proxyMediaController.js';
import * as transcodeVideoController from '../controllers/transcodeVideoController.js';
import * as guangdadaCnAdInfoController from '../controllers/guangdadaCnAdInfoController.js';
// Sensor Tower
import * as loginControllerSensorTower from '../controllers/loginControllerSensorTower.js';
import * as statusControllerSensorTower from '../controllers/statusControllerSensorTower.js';
import * as clearLoginControllerSensorTower from '../controllers/clearLoginControllerSensorTower.js';
import * as searchControllerSensorTower from '../controllers/searchControllerSensorTower.js';

const router = Router();

router.get('/health', healthController.getHealth);
router.get('/proxy-media', proxyMediaController.getProxyMedia);
router.post('/transcode-video', transcodeVideoController.transcodeVideo);
router.get('/transcode-queue', transcodeVideoController.getTranscodeQueue);
router.get('/download-image', proxyMediaController.getDownloadImage);
router.post('/health/clear-logs', healthController.postClearLogs);
router.post('/health/reopen-browser', healthController.postReopenBrowser);

// Insightrackr 网站路由
router.post('/insightrackr/login', loginControllerInsightrackr.login);
router.get('/insightrackr/status', statusControllerInsightrackr.getStatus);
router.post('/insightrackr/clearLogin', clearLoginControllerInsightrackr.clearLogin);
router.post('/insightrackr/search', searchControllerInsightrackr.search);
router.post('/insightrackr/search-global', searchControllerInsightrackr.searchGlobal);
router.post('/insightrackr/count', searchControllerInsightrackr.count);
router.post('/insightrackr/distribute/media', searchControllerInsightrackr.distributeMedia);
router.post('/insightrackr/distribute/app', searchControllerInsightrackr.distributeApp);
router.post('/insightrackr/distribute/adfaction', searchControllerInsightrackr.distributeAdfaction);

// 广大大网站路由
router.post('/guangdada/login', loginControllerGuangdada.login);
router.get('/guangdada/status', statusControllerGuangdada.getStatus);
router.post('/guangdada/clearLogin', clearLoginControllerGuangdada.clearLogin);
router.post('/guangdada/search', searchControllerGuangdada.search);
router.post('/guangdada/count', searchControllerGuangdada.count);
router.post('/guangdada/multi-modal-search', searchControllerGuangdada.multiModalSearch);
router.get('/guangdada/advertiser-association', searchControllerGuangdada.advertiserAssociation);
router.post('/guangdada/advertiser-association', searchControllerGuangdada.advertiserAssociation);
router.get('/guangdada/hidden-info', searchControllerGuangdada.hiddenInfo);
router.get('/guangdada/creative-detail', searchControllerGuangdada.creativeDetail);
router.post('/guangdada/creative-detail', searchControllerGuangdada.creativeDetail);
router.post('/guangdada/translate', searchControllerGuangdada.translateText);
router.get('/guangdada/daily-popularity', searchControllerGuangdada.dailyPopularity);
router.post('/guangdada/daily-popularity', searchControllerGuangdada.dailyPopularity);
router.post('/guangdada/related-advertisers', searchControllerGuangdada.relatedAdvertisers);
router.post('/guangdada/related-ads', searchControllerGuangdada.relatedAds);
router.get('/guangdada/advertiser-detail', searchControllerGuangdada.advertiserDetail);
router.post('/guangdada/adv-rec-list', searchControllerGuangdada.advRecList);
router.post('/guangdada/similar-ads', searchControllerGuangdada.similarAds);

// Sensor Tower
router.post('/sensortower/login', loginControllerSensorTower.login);
router.get('/sensortower/status', statusControllerSensorTower.getStatus);
router.post('/sensortower/clearLogin', clearLoginControllerSensorTower.clearLogin);
router.post('/sensortower/search', searchControllerSensorTower.search);

// 外部聚合调用（独立接口）
router.post('/external/insightrackr/top50', externalSearchController.externalInsightrackrTop50);
router.get('/external/insightrackr/top50', externalSearchController.externalInsightrackrTop50);
router.post('/external/guangdada/top50', externalSearchController.externalGuangdadaTop50);
router.get('/external/guangdada/top50', externalSearchController.externalGuangdadaTop50);

/** 临时：外部查询调试日志（生产默认关闭，见 EXTERNAL_SEARCH_DEBUG） */
router.get('/external/debug-log', externalSearchDebugController.getExternalSearchDebugLog);
router.post('/external/debug-log/clear', externalSearchDebugController.postClearExternalSearchDebugLog);

// 广大大国内版（BBA）广告列表代理
router.get('/guangdada-cn/ad-info', guangdadaCnAdInfoController.getGuangdadaCnAdInfo);

export default router;
