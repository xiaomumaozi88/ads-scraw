import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, theme, Dropdown } from 'antd';
import {
  BarChartOutlined,
  VideoCameraOutlined,
  HistoryOutlined,
  UserOutlined,
  LogoutOutlined,
  ColumnWidthOutlined,
  CloudServerOutlined,
  CompassOutlined,
  SearchOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useMaterialProcessing } from '../contexts/MaterialProcessingContext';
import { useAuth } from '../contexts/AuthContext';
import { IAM_DATA_SOURCES, canAccessMaterialProcessingHistory, canAccessHealthAdmin } from '../config/iam';
import { FEATURES } from '../config/features';
import { ROUTES, isInsightrackrRoute, isSensortowerRoute } from '../config/routes';
import { iamLogout } from '../utils/api';
import DownloadListDrawer from '../components/DownloadListDrawer';
import SensorTowerLogo from '../components/SensorTowerLogo.jsx';
import InsightrackrLogo from '../components/InsightrackrLogo.jsx';
import './AdminLayout.css';

const { Header, Sider, Content } = Layout;

const ALL_MENU_ITEMS = [
  {
    key: ROUTES.INSIGHTRACKR,
    platformKey: 'insightrackr',
    dataSource: IAM_DATA_SOURCES.INSIGHTRACKR,
    icon: <BarChartOutlined />,
    label: '热云',
  },
  {
    key: ROUTES.SENSORTOWER,
    platformKey: 'sensortower',
    dataSource: IAM_DATA_SOURCES.SENSORTOWER,
    icon: <SensorTowerLogo size={16} variant="on-dark" />,
    label: 'Sensor Tower',
  },
  {
    key: 'guangdada-platform',
    platformKey: 'guangdada',
    dataSource: IAM_DATA_SOURCES.GUANGDADA,
    icon: <CompassOutlined />,
    label: '广大大',
    children: [
      {
        key: ROUTES.GUANGDADA,
        icon: <SearchOutlined />,
        label: '创意查询',
        dataSource: IAM_DATA_SOURCES.GUANGDADA,
      },
      {
        key: ROUTES.GUANGDADA_RANK,
        icon: <TrophyOutlined />,
        label: '创意排行榜',
        dataSource: IAM_DATA_SOURCES.GUANGDADA,
      },
    ],
  },
  {
    key: 'material-processing',
    dataSource: IAM_DATA_SOURCES.MATERIAL_TOOLS,
    icon: <VideoCameraOutlined />,
    label: '素材处理',
    children: [
      {
        key: ROUTES.VIDEO_RESIZE,
        icon: <ColumnWidthOutlined />,
        label: '尺寸修改',
        dataSource: IAM_DATA_SOURCES.MATERIAL_TOOLS,
      },
      {
        key: ROUTES.MATERIAL_HISTORY,
        icon: <HistoryOutlined />,
        label: '处理历史',
        materialHistory: true,
      },
    ],
  },
  {
    key: 'health-admin',
    icon: <CloudServerOutlined />,
    label: '运维管理',
    feature: 'healthAdminMenu',
    healthAdmin: true,
    children: [
      {
        key: ROUTES.HEALTH,
        label: '健康概览',
        healthAdmin: true,
      },
      {
        key: ROUTES.TRANSCODE_QUEUE,
        label: '转码队列',
        healthAdmin: true,
      },
      {
        key: ROUTES.OPERATION_AUDITS,
        label: '操作审计',
        healthAdmin: true,
      },
    ],
  },
];

function filterMenuItems(items, hasDataSource, canAccessHistory, canAccessHealth) {
  const childVisible = (child, parent) => {
    if (child.materialHistory) return canAccessHistory();
    if (child.healthAdmin) return canAccessHealth();
    const ds = child.dataSource || parent.dataSource;
    return !ds || hasDataSource(ds);
  };

  return items
    .filter((item) => {
      if (item.healthAdmin && !canAccessHealth()) return false;
      if (item.feature && !FEATURES[item.feature]) return false;
      if (item.children) {
        return item.children.some((child) => childVisible(child, item));
      }
      if (item.dataSource && !hasDataSource(item.dataSource)) return false;
      return true;
    })
    .map((item) => {
      if (!item.children) {
        const { dataSource, feature, materialHistory, healthAdmin, platformKey, ...rest } = item;
        return rest;
      }
      return {
        ...(() => {
          const { dataSource, feature, materialHistory, healthAdmin, platformKey, ...rest } = item;
          return rest;
        })(),
        children: item.children
          .filter((child) => childVisible(child, item))
          .map(({ dataSource, feature, materialHistory, healthAdmin, platformKey, ...rest }) => rest),
      };
    });
}

function resolveSelectedKey(pathname) {
  if (pathname.startsWith(ROUTES.OPERATION_AUDITS)) return ROUTES.OPERATION_AUDITS;
  if (pathname.startsWith(ROUTES.TRANSCODE_QUEUE)) return ROUTES.TRANSCODE_QUEUE;
  if (pathname.startsWith(ROUTES.HEALTH)) return ROUTES.HEALTH;
  if (pathname.startsWith(ROUTES.MATERIAL_HISTORY)) {
    return ROUTES.MATERIAL_HISTORY;
  }
  if (pathname.startsWith(ROUTES.VIDEO_RESIZE)) return ROUTES.VIDEO_RESIZE;
  if (pathname.startsWith(ROUTES.GUANGDADA_RANK)) return ROUTES.GUANGDADA_RANK;
  if (pathname.startsWith(ROUTES.GUANGDADA)) return ROUTES.GUANGDADA;
  if (isSensortowerRoute(pathname)) return ROUTES.SENSORTOWER;
  if (isInsightrackrRoute(pathname)) return ROUTES.INSIGHTRACKR;
  return ROUTES.INSIGHTRACKR;
}

function resolveOpenKeys(pathname) {
  if (pathname.startsWith('/tools/')) return ['material-processing'];
  if (pathname.startsWith(ROUTES.HEALTH)) return ['health-admin'];
  if (pathname.startsWith(ROUTES.GUANGDADA)) return ['guangdada-platform'];
  return [];
}

function resolveHeaderTitle(pathname) {
  if (pathname.startsWith(ROUTES.OPERATION_AUDITS)) return '操作审计';
  if (pathname.startsWith(ROUTES.TRANSCODE_QUEUE)) return '视频转码队列';
  if (pathname.startsWith(ROUTES.HEALTH)) return '系统健康';
  if (pathname.startsWith(ROUTES.MATERIAL_HISTORY)) return '素材处理历史';
  if (pathname.startsWith(ROUTES.VIDEO_RESIZE)) return '素材尺寸修改';
  if (pathname.startsWith(ROUTES.GUANGDADA)) return '广大大';
  return '广告数据平台';
}

function renderHeaderTitle(pathname) {
  if (isInsightrackrRoute(pathname)) {
    return (
      <>
        <InsightrackrLogo
          size={36}
          className="admin-layout__header-platform-logo"
          loading="eager"
        />
        <span className="admin-layout__header-platform-name">Insightrackr</span>
      </>
    );
  }
  if (isSensortowerRoute(pathname)) {
    return (
      <>
        <SensorTowerLogo
          size={36}
          className="admin-layout__header-platform-logo"
          loading="eager"
        />
        <span className="admin-layout__header-platform-name">Sensor Tower</span>
      </>
    );
  }
  return resolveHeaderTitle(pathname);
}

function AdminLayout({
  children,
  contentClassName = '',
  contentStyle,
  headerExtra,
  loginStatusNode,
  downloadListBtnRef,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const [downloadDrawerOpen, setDownloadDrawerOpen] = useState(false);
  const [menuOpenKeys, setMenuOpenKeys] = useState(() => resolveOpenKeys(location.pathname));
  const internalDownloadBtnRef = useRef(null);
  const resolvedDownloadBtnRef = downloadListBtnRef || internalDownloadBtnRef;
  const { downloadList, downloading } = useMaterialProcessing();
  const { profile, refresh, hasDataSource: checkDs } = useAuth();

  const menuItems = useMemo(() => {
    return filterMenuItems(
      ALL_MENU_ITEMS,
      checkDs,
      () => canAccessMaterialProcessingHistory(profile),
      () => canAccessHealthAdmin(profile)
    );
  }, [checkDs, profile]);

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ];

  const handleUserMenu = async ({ key }) => {
    if (key === 'logout') {
      await iamLogout();
      await refresh();
    }
  };

  const selectedKey = useMemo(
    () => resolveSelectedKey(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    setMenuOpenKeys((prev) => {
      const next = resolveOpenKeys(location.pathname);
      return next.length ? [...new Set([...prev, ...next])] : prev;
    });
  }, [location.pathname]);

  const pendingOrProcessing = downloadList.filter(
    (item) => item.status === 'pending' || item.status === 'processing'
  ).length;

  return (
    <Layout className="admin-layout">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        className="admin-layout__sider"
        theme="dark"
      >
        <div className="admin-layout__brand">
          <img
            src="/logo.png"
            alt="广告数据平台"
            className="admin-layout__brand-icon"
            width={28}
            height={28}
          />
          {!collapsed && <span className="admin-layout__brand-text">广告数据平台</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          openKeys={collapsed ? [] : menuOpenKeys}
          onOpenChange={setMenuOpenKeys}
          items={menuItems}
          onClick={({ key }) => {
            if (key.startsWith('/')) navigate(key);
          }}
        />
      </Sider>
      <Layout>
        <Header
          className="admin-layout__header"
          style={{ background: token.colorBgContainer }}
        >
          <div className="admin-layout__header-title">
            {renderHeaderTitle(location.pathname)}
          </div>
          <div className="admin-layout__header-actions">
            {headerExtra}
            <Button
              ref={resolvedDownloadBtnRef}
              type="default"
              onClick={() => setDownloadDrawerOpen(true)}
            >
              下载列表
              {pendingOrProcessing > 0 ? ` (${pendingOrProcessing})` : ''}
              {downloading ? ' · 处理中' : ''}
            </Button>
            {loginStatusNode}
            {profile?.user_name ? (
              <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenu }} placement="bottomRight">
                <Button type="text" icon={<UserOutlined />}>
                  {profile.user_name}
                </Button>
              </Dropdown>
            ) : null}
          </div>
        </Header>
        <Content
          className={`admin-layout__content ${contentClassName}`.trim()}
          style={contentStyle}
        >
          {children}
        </Content>
      </Layout>

      <DownloadListDrawer
        open={downloadDrawerOpen}
        onClose={() => setDownloadDrawerOpen(false)}
      />
    </Layout>
  );
}

export { resolveSelectedKey };
export default AdminLayout;
