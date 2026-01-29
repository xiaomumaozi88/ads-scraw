# Insightrackr API 请求参数说明与字段映射

## 请求参数结构说明

```json
{
    // ========== 关键词相关 ==========
    "keyWord": "",                    // 搜索关键词（对应：关键词输入框）
    "keyWordType": "0,1,2,3,4,6,8",  // 关键词类型（固定值）
    "keyWordList": [],                // 关键词列表（未使用）
    "keyWordListType": true,          // 关键词列表类型（未使用）
    "isNew": false,                   // 只看新增（对应：只看新增复选框）
    
    // ========== 创意相关 ==========
    "creativeList": [                 // 创意规格（对应：创意规格选择器）
        {
            "creativeKey": "sz",      // 尺寸：sz
            "creativeValue": "1280,720"
        },
        {
            "creativeKey": "spsc",   // 视频时长：spsc
            "creativeValue": "less60"
        },
        {
            "creativeKey": "qxd",    // 清晰度：qxd
            "creativeValue": "HD"
        },
        {
            "creativeKey": "gs",     // 格式：gs
            "creativeValue": "1"
        }
    ],
    "appealTypeList": [],             // 行动号召（对应：行动号召选择器）
    "interactionList": [              // 互动指标（对应：互动指标选择器）
        {
            "interactionKey": "share",
            "interactionValue": "1001,"
        },
        {
            "interactionKey": "comment",
            "interactionValue": "101,1000"
        },
        {
            "interactionKey": "like",
            "interactionValue": "101,1000"
        }
    ],
    "languages": [],                   // 标题语言（对应：标题语言选择器）
    
    // ========== 产品相关 ==========
    "productIds": [],                 // 产品ID（未使用）
    "productOption": {
        "productType": [],            // 产品类型/行业类型（对应：行业类型级联选择器）
        "selling": [],                // 搜索推广方式（对应：推广方式级联选择器）
        "monetization": [],           // 变现类型（对应：变现类型选择器）
        "payType": [],                // 下载类型（对应：下载类型选择器）
        "companyLocation": [],        // 公司位置（未使用）
        "campaignList": []            // 活动列表（未使用，但示例中有值）
    },
    
    // ========== 基础选项 ==========
    "baseOption": {
        "permission": false,           // 权限（固定值）
        "putOverseaInland": null,      // 海外/国内（未使用）
        "tradeLevel1": [],            // 行业一级分类（未使用）
        "tradeLevel2": [],            // 行业二级分类（未使用）
        "tradeLevel3": [],            // 行业三级分类（未使用，但示例中有值）
        "subjectType": [],            // 主题类型（未使用，但示例中有值）
        "countryLevel2": [],          // 国家/地区（对应：国家/地区级联选择器）
        "adfactionIds": [],           // 广告行动号召ID（未使用）
        "mediaIds": [],               // 流量渠道（对应：流量渠道选择器）
        "device": [],                 // 操作系统（对应：操作系统选择器）
        "topicType": [],              // 主题类型（未使用，但示例中有值）
        "productModel": [],           // 产品模型（对应：产品模型选择器）
        "dayMode": "DD",              // 日期模式（固定值："DD"）
        "startTime": "2025-01-28",    // 开始时间（对应：时间范围选择器的开始日期）
        "endTime": "2026-01-27",      // 结束时间（对应：时间范围选择器的结束日期）
        "compareEndDate": "",         // 对比结束日期（未使用）
        "compareStartDate": "",       // 对比开始日期（未使用）
        "pageIndex": 1,               // 页码（固定值：1）
        "pageSize": 60,               // 每页数量（固定值：60）
        "sortField": "17",            // 排序字段（对应：排序选择器的排序字段）
        "sortRule": "desc",           // 排序规则（对应：排序选择器的排序规则，"desc"或"asc"）
        "gptSearch": true,            // GPT搜索（固定值：true）
        "globalSearch": true,         // 全局搜索（固定值：true）
        "materialTopLimit": "500",    // 曝光预估（对应：曝光预估选择器，如"500"表示top500）
        "szfxList": [                 // 受众分析（对应：受众分析选择器）
            {
                "szfxKey": "gender",
                "szfxValue": ["F50"]
            },
            {
                "szfxKey": "Age",
                "szfxValue": ["18-24"]
            }
        ]
    },
    
    // ========== 其他参数 ==========
    "materialType": "2",              // 素材类型（对应：创意类型选择器，如"2"表示视频）
    "classIds": [],                   // 游戏题材（对应：游戏题材选择器）
    "seelTargets": [],                // 产品主题（对应：产品主题选择器）
    "webTools": [],                   // 未使用
    "demoadFormats": [],              // 创意类型（对应：创意类型选择器）
    "adMediaType": [],                // 广告类型（对应：广告类型选择器）
    "materialTag": [],                // 素材标签（对应：素材标签选择器）
    "creativeTeam": [],               // 创意团队（未使用）
    "materialRemovalRepeat": false    // 素材去重（固定值：false，但示例中是true）
}
```

## 字段映射关系

### ✅ 已映射的字段（UI中有对应选择器）

| UI字段名称 | formData字段 | API参数路径 | 数据格式 | 说明 |
|-----------|-------------|------------|---------|------|
| 关键词 | `keyWord` | `keyWord` | 字符串 | 直接映射 |
| 只看新增 | `isNew` | `isNew` | 布尔值 | 直接映射 |
| 国家/地区 | `countryLevel2` | `baseOption.countryLevel2` | 数组 | 级联选择器的值 |
| 流量渠道 | `mediaIds` | `baseOption.mediaIds` | 数组 | 多选，值为媒体ID |
| 广告类型 | `adMediaType` | `adMediaType` | 数组 | 单个值转为数组 |
| 操作系统 | `device` | `baseOption.device` | 数组 | 数组，如["2"]表示iOS |
| 行业类型 | `productType` | `productOption.productType` | 数组 | 级联选择器的值 |
| 产品模型 | `productModel` | `baseOption.productModel` | 数组 | 单个值转为数组 |
| 推广方式 | `selling` | `productOption.selling` | 数组 | 级联选择器的值 |
| 游戏题材 | `classIds` | `classIds` | 数组 | 多选，值为题材ID |
| 产品主题 | `seelTargets` | `seelTargets` | 数组 | 多选，值为主题ID |
| 变现类型 | `monetization` | `productOption.monetization` | 数组 | 单个值转为数组 |
| 下载类型 | `payType` | `productOption.payType` | 数组 | 单个值转为数组 |
| 上架状态 | `listingStatus` | ❌ 未映射 | - | **待确认API参数** |
| 创意类型 | `creativeType` | `demoadFormats` / `materialType` | 数组/字符串 | 同时映射到两个字段 |
| 创意规格 | `creativeSpec` | `creativeList` | 对象→数组 | 转换为 `[{creativeKey, creativeValue}]` 格式 |
| 标题语言 | `languages` | `languages` | 数组 | 单个值转为数组 |
| 行动号召 | `appealTypeList` | `appealTypeList` | 数组 | 多选，值为行动号召ID |
| 素材标签 | `materialTag` | `materialTag` | 数组 | 多选，值为标签ID |
| 受众分析 | `audienceAnalysis` | `baseOption.szfxList` | 对象→数组 | 转换为 `[{szfxKey, szfxValue}]` 格式 |
| 曝光预估 | `exposureEstimateRange` | `baseOption.materialTopLimit` | 字符串 | 直接映射，如"500"表示top500 |
| 互动指标 | `interactionMetrics` | `interactionList` | 对象→数组 | 转换为 `[{interactionKey, interactionValue}]` 格式 |
| 时间范围 | `dateRange` | `baseOption.startTime` / `baseOption.endTime` | 日期范围→字符串 | 转换为 "YYYY-MM-DD" 格式 |
| 排序字段 | `sortField` | `baseOption.sortField` | 字符串 | 值映射见下方 |
| 排序规则 | `sortRule` | `baseOption.sortRule` | 字符串 | "desc" 或 "asc" |

### 📋 排序字段值映射

| UI显示名称 | sortField值 | 说明 |
|-----------|-----------|------|
| 相关性 | `"11"` | 默认排序 |
| 关联创意组数 | `"14"` |  |
| 首次发现时间 | `"3"` |  |
| 投放天数 | `"4"` |  |
| 曝光预估 | `"15"` |  |
| 播放 | `"8"` |  |
| 点赞 | `"5"` |  |
| 评论 | `"6"` |  |
| 转发 | `"7"` |  |
| 受众人群数量 | `"16"` |  |
| 素材热度 | `"17"` |  |

### 🔄 数据格式转换说明

#### 1. 创意规格 (`creativeSpec` → `creativeList`)

**UI格式**：
```javascript
{
  size: "1280,720",        // 预设尺寸的ccode，或为空
  customWidth: "1280",      // 自定义宽度
  customHeight: "720",     // 自定义高度
  videoDuration: "less60", // 视频时长的ccode
  clarity: "HD",           // 清晰度的ccode
  format: ["1", "2"]       // 格式的ccode数组
}
```

**API格式**：
```javascript
[
  { creativeKey: "sz", creativeValue: "1280,720" },
  { creativeKey: "spsc", creativeValue: "less60" },
  { creativeKey: "qxd", creativeValue: "HD" },
  { creativeKey: "gs", creativeValue: "1" },
  { creativeKey: "gs", creativeValue: "2" }
]
```

**转换规则**：
- `creativeKey` 值：
  - `"sz"` - 尺寸（size）
  - `"spsc"` - 视频时长（videoDuration）
  - `"qxd"` - 清晰度（clarity）
  - `"gs"` - 格式（format，多选时每个值单独一条）
- 如果选择了预设尺寸，使用 `spec.size` 的 ccode
- 如果使用自定义尺寸，格式为 `${customWidth},${customHeight}`

#### 2. 互动指标 (`interactionMetrics` → `interactionList`)

**UI格式**：
```javascript
{
  share: {
    preset: "1001-",      // 预设范围的ccode，或为空
    customMin: "1000",    // 自定义最小值
    customMax: "5000"     // 自定义最大值
  },
  comment: {
    preset: "101-1000",
    customMin: "",
    customMax: ""
  },
  like: {
    preset: "",
    customMin: "50",
    customMax: "200"
  }
}
```

**API格式**：
```javascript
[
  { interactionKey: "share", interactionValue: "1001," },
  { interactionKey: "comment", interactionValue: "101,1000" },
  { interactionKey: "like", interactionValue: "50,200" }
]
```

**转换规则**：
- `interactionKey` 值：`"share"`（分享）、`"comment"`（评论）、`"like"`（点赞）
- `interactionValue` 格式：
  - 预设值 `"1001-"` → `"1001,"`（注意末尾逗号，表示大于等于）
  - 预设值 `"101-1000"` → `"101,1000"`（范围）
  - 预设值 `"1-100"` → `"1,100"`（范围）
  - 自定义值：`${min},${max}` 或 `${min},`（只有最小值时）

#### 3. 受众分析 (`audienceAnalysis` → `baseOption.szfxList`)

**UI格式**：
```javascript
{
  gender: "F50",              // 性别占比的ccode
  ageGroups: ["18-24", "25-34"] // 年龄段的ccode数组
}
```

**API格式**：
```javascript
[
  { szfxKey: "gender", szfxValue: ["F50"] },
  { szfxKey: "Age", szfxValue: ["18-24", "25-34"] }
]
```

**转换规则**：
- `szfxKey` 值：
  - `"gender"` - 性别占比
  - `"Age"` - 年龄段
- `szfxValue` 始终为数组格式

#### 4. 曝光预估 (`exposureEstimateRange` → `baseOption.materialTopLimit`)

**UI格式**：字符串，如 `"500"`（表示 top500）

**API格式**：字符串，如 `"500"`

**转换规则**：直接映射，ccode值（"100", "500", "2000"）直接使用

### ❌ 未映射的字段（UI中有但API参数中未使用）

1. **上架状态** (`listingStatus`) - 需要确认API是否支持此参数

### ⚠️ 需要注意的问题

1. **创意类型双重映射**：
   - `creativeType` 同时映射到 `demoadFormats`（数组）和 `materialType`（字符串）
   - 示例中 `materialType: "2"` 表示视频类型

2. **baseOption 中的未使用字段**：
   - `tradeLevel3`、`subjectType`、`topicType` 在示例中有值，但UI中未配置
   - 可能需要从级联选择器中提取，或通过其他方式获取

3. **materialRemovalRepeat**：
   - 固定值为 `false`，但示例中为 `true`
   - 可能需要根据用户选择或业务逻辑动态设置

4. **productOption.campaignList**：
   - 示例中有值：`["retargeting","app store","google play","direct market"]`
   - UI中未配置，可能需要添加相应的选择器

## 实现状态

✅ **已实现**：所有主要字段的映射关系已确认并实现  
⚠️ **待确认**：上架状态字段的API参数名  
📝 **待优化**：部分字段可能需要从级联选择器中提取更深层级的值
