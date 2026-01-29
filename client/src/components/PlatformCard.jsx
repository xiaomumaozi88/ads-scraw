import React from 'react';

function PlatformCard({ platform, onPlatformChange, addLog }) {
  const handleChange = (e) => {
    const newPlatform = e.target.value;
    onPlatformChange(newPlatform);
    addLog(`切换到平台: ${newPlatform}`, 'info');
  };

  return (
    <div className="card platform-card">
      <h2>选择平台</h2>
      <div className="form-group">
        <label htmlFor="platformSelect">平台</label>
        <select
          id="platformSelect"
          name="platform"
          className="form-control"
          value={platform}
          onChange={handleChange}
        >
          <option value="insightrackr">Insightrackr</option>
          <option value="guangdada" disabled>广大大 (即将推出)</option>
        </select>
      </div>
    </div>
  );
}

export default PlatformCard;
