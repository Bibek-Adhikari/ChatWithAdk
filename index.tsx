import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';

import LandingPage from './components/LandingPage';
import UsersData from './components/UsersData';
import PricingPage from './components/PricingPage';
import NotificationsPage from './components/NotificationsPage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const theme = (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Landing page — only shown at exact root */}
        <Route path="/" element={<LandingPage />} />

        {/* Main chat app — requires a session ID */}
        <Route path="/chat/:sessionId" element={<App />} />

        {/* Specialist tool overlays — App handles showing the tool based on path */}
        <Route path="/codeadk" element={<App initialTool="codeadk" />} />
        <Route path="/photoadk" element={<App initialTool="photoadk" />} />
        <Route path="/converteradk" element={<App initialTool="converteradk" />} />
        <Route path="/converteradk/history" element={<App initialTool="converteradk" />} />

        {/* Other standalone pages */}
        <Route path="/plans" element={<PricingPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/admin/usersData/:userId" element={<UsersData theme={theme} />} />

        {/* Fallback — redirect anything unknown to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
