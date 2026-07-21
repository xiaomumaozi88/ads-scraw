import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, Row, Space, Switch, Tag, Typography, message } from 'antd';
import { updatePlatformCredentials } from '../../../utils/api';

const { Text } = Typography;

const PLATFORM_ORDER = ['insightrackr', 'guangdada', 'sensortower'];

const SOURCE_LABEL = {
  admin_config: '运维配置',
  env: '环境变量',
  none: '未配置',
};

function PlatformCredentialEditor({ item, saving, onSave }) {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue({
      email: item?.email || '',
      password: '',
      autoLoginEnabled: item?.autoLoginEnabled !== false,
    });
  }, [form, item]);

  const handleFinish = (values) => {
    const payload = {
      email: values.email,
      autoLoginEnabled: values.autoLoginEnabled !== false,
    };
    if (values.password) payload.password = values.password;
    onSave(item.platform, payload, form);
  };

  return (
    <div className="health-page__credential-item">
      <div className="health-page__credential-head">
        <Space size={8} wrap>
          <Text strong>{item.name}</Text>
          <Tag color={item.configured ? 'green' : 'orange'}>
            {item.configured ? '已配置' : '未配置'}
          </Tag>
          <Tag>{SOURCE_LABEL[item.source] || item.source || '未知来源'}</Tag>
        </Space>
        <Text type="secondary" className="health-page__credential-email">
          {item.emailPreview || item.email || '-'}
        </Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        className="health-page__credential-form"
        onFinish={handleFinish}
      >
        <Row gutter={12}>
          <Col xs={24} md={10}>
            <Form.Item
              label="账号邮箱"
              name="email"
              rules={[
                { required: true, message: '请输入账号邮箱' },
                { type: 'email', message: '请输入有效邮箱' },
              ]}
            >
              <Input autoComplete="off" placeholder="请输入账号邮箱" />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item label="密码" name="password">
              <Input.Password
                autoComplete="new-password"
                placeholder={item.hasPassword ? '留空则不修改密码' : '请输入密码'}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={4}>
            <Form.Item
              label="自动登录"
              name="autoLoginEnabled"
              valuePropName="checked"
            >
              <Switch checkedChildren="开" unCheckedChildren="关" />
            </Form.Item>
          </Col>
        </Row>
        <div className="health-page__credential-actions">
          <Text type="secondary" className="health-page__credential-meta">
            {item.updatedAt
              ? `上次更新：${new Date(item.updatedAt).toLocaleString('zh-CN', { hour12: false })}`
              : '尚未由运维页更新'}
          </Text>
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
          >
            保存
          </Button>
        </div>
      </Form>
    </div>
  );
}

function HealthPlatformCredentialsPanel({ credentials, onSaved }) {
  const [savingPlatform, setSavingPlatform] = useState(null);

  const items = useMemo(() => {
    const map = new Map((credentials || []).map((item) => [item.platform, item]));
    return PLATFORM_ORDER.map((platform) => map.get(platform)).filter(Boolean);
  }, [credentials]);

  const handleSave = async (platform, values, form) => {
    setSavingPlatform(platform);
    try {
      await updatePlatformCredentials(platform, values);
      form.setFieldValue('password', '');
      message.success('平台账号配置已保存');
      onSaved?.();
    } catch (error) {
      message.error(error.message || '保存失败');
    } finally {
      setSavingPlatform(null);
    }
  };

  return (
    <Card title="平台账号配置" className="health-page__panel">
      <Alert
        type="info"
        showIcon
        className="health-page__credential-alert"
        message="用于页面右上角“点击登录”和服务启动后的自动登录；密码只会保存为服务端加密配置，不会在页面回显。"
      />
      <div className="health-page__credential-list">
        {items.map((item) => (
          <PlatformCredentialEditor
            key={item.platform}
            item={item}
            saving={savingPlatform === item.platform}
            onSave={handleSave}
          />
        ))}
      </div>
    </Card>
  );
}

export default HealthPlatformCredentialsPanel;
