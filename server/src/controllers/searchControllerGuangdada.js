import * as puppeteerService from '../services/puppeteerService.js';

/**
 * 广大大搜索：由后端在已登录的浏览器中请求 guangdada.net/napi/v1/creative/list
 * 前端需先登录，后端浏览器登录后跳转到 display-ads 并持久化认证信息，查询时在浏览器内发起请求
 */
export const search = async (req, res) => {
  try {
    const searchParams = req.body || {};
    const result = await puppeteerService.fetchSearchData(searchParams);

    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message
      });
    }

    res.status(200).json({
      data: result.data,
      success: true,
      code: result.code,
      message: result.message
    });
  } catch (error) {
    console.error('广大大搜索失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求搜索数据失败: ${error.message || '未知错误'}`
    });
  }
};

/** 广大大 count 接口：参数与 search 一致，返回 all_total / default_total / result_total，用于分页 */
export const count = async (req, res) => {
  try {
    const searchParams = req.body || {};
    const result = await puppeteerService.fetchCountData(searchParams);

    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message
      });
    }

    res.status(200).json({
      data: result.data,
      success: true,
      code: result.code,
      message: result.message
    });
  } catch (error) {
    console.error('广大大 count 失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求 count 失败: ${error.message || '未知错误'}`
    });
  }
};
