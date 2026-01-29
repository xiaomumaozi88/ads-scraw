import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import 'antd/dist/reset.css';
import 'flag-icon-css/css/flag-icons.min.css';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/insightrackr" element={<App />} />
        <Route path="/guangdada" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
