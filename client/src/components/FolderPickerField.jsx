import React from 'react';
import { Button, Space, Typography } from 'antd';
import { FolderOpenOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useMaterialProcessing } from '../contexts/MaterialProcessingContext';

const { Text } = Typography;

function FolderPickerField({ size = 'middle' }) {
  const {
    isFolderPickerSupported,
    downloadFolderName,
    pickDownloadFolder,
    clearDownloadFolder,
  } = useMaterialProcessing();

  if (!isFolderPickerSupported) {
    return (
      <Text type="secondary" style={{ fontSize: 13 }}>
        当前浏览器不支持选择保存文件夹，将使用浏览器默认下载位置
      </Text>
    );
  }

  return (
    <Space wrap align="center">
      <Button size={size} icon={<FolderOpenOutlined />} onClick={() => pickDownloadFolder()}>
        选择保存文件夹
      </Button>
      {downloadFolderName ? (
        <>
          <Text type="secondary">已选：{downloadFolderName}</Text>
          <Button
            size={size}
            type="text"
            icon={<CloseCircleOutlined />}
            onClick={clearDownloadFolder}
          >
            清除
          </Button>
        </>
      ) : (
        <Text type="secondary">未选择文件夹时将保存到浏览器默认下载目录</Text>
      )}
    </Space>
  );
}

export default FolderPickerField;
