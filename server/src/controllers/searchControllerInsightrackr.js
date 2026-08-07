import * as puppeteerService from '../services/puppeteerServiceInsightrackr.js';
import { logger } from '../utils/logger.js';
import { scheduleSearchResultIngestion } from '../services/creativeIntelligenceAutoSyncService.js';

/**
 * 构建搜索请求参数
 * 支持从简单参数（如 keyWord）扩展到完整的请求体
 */
function buildSearchParams(reqBody) {
    const {
        keyWord,
        pageIndex = 1,
        pageSize = 60,
        startTime = '2025-01-24',
        endTime = '2026-01-23',
        sortField = '8',
        sortRule = 'desc',
        baseOption,
        ...otherParams
    } = reqBody || {};
    
    // 如果已经提供了完整的 baseOption，直接使用
    // 否则根据传入的简单参数构建
    const finalBaseOption = baseOption || {
        permission: false,
        putOverseaInland: null,
        tradeLevel1: [],
        tradeLevel2: [],
        tradeLevel3: [],
        subjectType: [],
        countryLevel2: ["BB","BM","CU","CA","US","AU","PG","FJ","NZ"],
        adfactionIds: [],
        mediaIds: [],
        device: [],
        topicType: [],
        dayMode: "DY",
        productModel: [],
        startTime: startTime,
        endTime: endTime,
        compareEndDate: "",
        compareStartDate: "",
        pageIndex: parseInt(pageIndex) || 1,
        pageSize: parseInt(pageSize) || 60,
        sortField: sortField,
        sortRule: sortRule,
        gptSearch: false,
        globalSearch: true
    };
    
    // 构建完整的搜索参数
    return {
        keyWord: keyWord,
        keyWordType: reqBody.keyWordType || "0,1,2,3,4,6,8",
        keyWordList: reqBody.keyWordList || [],
        keyWordListType: reqBody.keyWordListType !== undefined ? reqBody.keyWordListType : true,
        isNew: reqBody.isNew !== undefined ? reqBody.isNew : false,
        creativeList: reqBody.creativeList || [],
        appealTypeList: reqBody.appealTypeList || [],
        interactionList: reqBody.interactionList || [],
        languages: reqBody.languages || [],
        productIds: reqBody.productIds || [],
        productOption: reqBody.productOption || {
            productType: [],
            selling: [],
            monetization: [],
            payType: [],
            companyLocation: [],
            campaignList: []
        },
        baseOption: finalBaseOption,
        classIds: reqBody.classIds || [],
        seelTargets: reqBody.seelTargets || [],
        webTools: reqBody.webTools || [],
        demoadFormats: reqBody.demoadFormats || [],
        adMediaType: reqBody.adMediaType || [],
        materialRemovalRepeat: reqBody.materialRemovalRepeat !== undefined ? reqBody.materialRemovalRepeat : false,
        ...otherParams // 允许传递其他自定义参数
    };
}

export const search = async (req, res) => {
    try {
        const searchParams = buildSearchParams(req.body);
        logger.info('搜索参数:', JSON.stringify(searchParams, null, 2));
        const data = await puppeteerService.fetchSearchData(searchParams);
        
        // 确保返回的数据是有效的对象
        if (!data || typeof data !== 'object') {
            logger.warn('返回的数据格式异常:', data);
            return res.status(200).json({
                data: null,
                success: false,
                code: 500,
                message: '服务器返回数据格式异常'
            });
        }
        scheduleSearchResultIngestion({
            platform: 'insightrackr',
            result: data,
            searchParams,
            operatorProfile: req.iamProfile,
        });
        res.json({...data});
    } catch (error) {
        console.error(error);
        logger.error(`请求搜索数据失败: ${error}`);
        res.status(200).json({
            data: null, 
            success: false, 
            code: 500, 
            message: `请求搜索数据失败: ${error.message || '未知错误'}`
        });
    }
};

// 获取数据总数（count 接口）
export const count = async (req, res) => {
    try {
        const searchParams = buildSearchParams(req.body);
        logger.info('Count 请求参数:', JSON.stringify(searchParams, null, 2));
        const data = await puppeteerService.fetchCountData(searchParams);
        
        // 确保返回的数据是有效的对象
        if (!data || typeof data !== 'object') {
            logger.warn('Count 返回的数据格式异常:', data);
            return res.status(200).json({
                data: null,
                success: false,
                code: 500,
                message: '服务器返回数据格式异常'
            });
        }
        res.json({...data});
    } catch (error) {
        console.error(error);
        logger.error(`请求 count 数据失败: ${error}`);
        res.status(200).json({
            data: null, 
            success: false, 
            code: 500, 
            message: `请求 count 数据失败: ${error.message || '未知错误'}`
        });
    }
};

// 流量分布渠道（distribute/media）- 参数与 search 一致，body 需包含 ids（当前列表创意 id 数组）
export const distributeMedia = async (req, res) => {
    try {
        const searchParams = buildSearchParams(req.body);
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
        const result = await puppeteerService.fetchDistributeMedia(searchParams, ids);
        if (!result.success && result.code === 'NO_LOGIN_PAGE') {
            return res.status(200).json({
                data: null,
                success: false,
                code: result.code,
                message: result.message || '请先登录'
            });
        }
        res.json({
            data: result.data,
            success: result.success,
            code: result.code,
            message: result.message
        });
    } catch (error) {
        logger.error(`请求 distribute/media 失败: ${error}`);
        res.status(200).json({
            data: null,
            success: false,
            code: 500,
            message: error.message || '请求失败'
        });
    }
};

// 全局搜索（search-global）：应用/产品、开发者；keyWord + searchType，可选 baseOption（两请求 searchType "1"/"2" 均需带 baseOption）
export const searchGlobal = async (req, res) => {
    try {
        const { keyWord = '', searchType = '1', baseOption } = req.body || {};
        const result = await puppeteerService.fetchSearchGlobal(keyWord, searchType, baseOption);
        if (!result.success && result.code === 'NO_LOGIN_PAGE') {
            return res.status(200).json({
                data: null,
                success: false,
                code: result.code,
                message: result.message || '请先登录'
            });
        }
        res.json({
            data: result.data,
            success: result.success,
            code: result.code,
            message: result.message
        });
    } catch (error) {
        logger.error(`请求 search-global 失败: ${error}`);
        res.status(200).json({
            data: null,
            success: false,
            code: 500,
            message: error.message || '请求失败'
        });
    }
};

// 广告发行商/App 信息（distribute/app）- 参数与 search 一致，body 需包含 ids；试玩广告走 preplay
export const distributeApp = async (req, res) => {
    try {
        const searchParams = buildSearchParams(req.body);
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
        const result = await puppeteerService.fetchDistributeApp(searchParams, ids);
        if (!result.success && result.code === 'NO_LOGIN_PAGE') {
            return res.status(200).json({
                data: null,
                success: false,
                code: result.code,
                message: result.message || '请先登录'
            });
        }
        res.json({
            data: result.data,
            success: result.success,
            code: result.code,
            message: result.message
        });
    } catch (error) {
        logger.error(`请求 distribute/app 失败: ${error}`);
        res.status(200).json({
            data: null,
            success: false,
            code: 500,
            message: error.message || '请求失败'
        });
    }
};

// 行动号召分布（distribute/adfaction）- 参数与 search 一致，body 需包含 ids；试玩广告走 preplay
export const distributeAdfaction = async (req, res) => {
    try {
        const searchParams = buildSearchParams(req.body);
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
        const result = await puppeteerService.fetchDistributeAdfaction(searchParams, ids);
        if (!result.success && result.code === 'NO_LOGIN_PAGE') {
            return res.status(200).json({
                data: null,
                success: false,
                code: result.code,
                message: result.message || '请先登录'
            });
        }
        res.json({
            data: result.data,
            success: result.success,
            code: result.code,
            message: result.message
        });
    } catch (error) {
        logger.error(`请求 distribute/adfaction 失败: ${error}`);
        res.status(200).json({
            data: null,
            success: false,
            code: 500,
            message: error.message || '请求失败'
        });
    }
};
