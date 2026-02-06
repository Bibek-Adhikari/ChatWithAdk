import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';

import UsersData from './components/UsersData';

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
        <Route path="/" element={<App />} />
        <Route path="/chat/:sessionId" element={<App />} />
        <Route path="/admin/usersData/:userId" element={<UsersData theme={theme} />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
