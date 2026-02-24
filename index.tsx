import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import App from './App';
import LandingPage from './components/LandingPage';
import UsersData from './components/UsersData';
import PricingPage from './components/PricingPage';
import NotificationsPage from './components/NotificationsPage';
import { readString } from './services/storage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const theme = (readString('theme', 'dark') as 'light' | 'dark');

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

// Component that conditionally wraps with Elements
const StripeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const needsStripe = ['/plans', '/admin'].some(path => location.pathname.startsWith(path));
  
  if (!needsStripe) return <>{children}</>;
  
  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <StripeProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/chat/:sessionId" element={<App />} />
          <Route path="/codeadk" element={<App initialTool="codeadk" />} />
          <Route path="/photoadk" element={<App initialTool="photoadk" />} />
          <Route path="/converteradk" element={<App initialTool="converteradk" />} />
          <Route path="/converteradk/history" element={<App initialTool="converteradk" />} />
          
          {/* These routes now have access to useStripe */}
          <Route path="/plans" element={<PricingPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/admin/usersData/:userId" element={<UsersData theme={theme} />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </StripeProvider>
    </BrowserRouter>
  </React.StrictMode>
);