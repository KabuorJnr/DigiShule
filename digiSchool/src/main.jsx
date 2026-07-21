import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register PWA Service Worker if supported
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        // Create a floating toast notification asking the user to refresh
        const toast = document.createElement('div');
        toast.innerHTML = `
          <div style="position: fixed; bottom: 24px; right: 24px; background: #1e293b; color: #fff; padding: 16px 20px; border-radius: 12px; z-index: 99999; box-shadow: 0 10px 25px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 20px; font-family: system-ui, sans-serif; animation: slideUp 0.3s ease-out;">
            <div>
              <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">Update Available 🚀</div>
              <div style="font-size: 13px; opacity: 0.8;">A new version of DigiSchool is ready.</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button id="pwa-refresh-btn" style="background: #047857; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; transition: background 0.2s;">Refresh Now</button>
              <button id="pwa-close-btn" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; transition: background 0.2s;">Dismiss</button>
            </div>
          </div>
          <style>
            @keyframes slideUp { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            #pwa-refresh-btn:hover { background: #065f46 !important; }
            #pwa-close-btn:hover { background: rgba(255,255,255,0.2) !important; }
          </style>
        `;
        document.body.appendChild(toast);
        
        document.getElementById('pwa-refresh-btn').onclick = () => updateSW(true);
        document.getElementById('pwa-close-btn').onclick = () => toast.remove();
      }
    });
  }).catch(() => {});
}

import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)



