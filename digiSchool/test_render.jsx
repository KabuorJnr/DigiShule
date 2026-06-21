import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './src/App.jsx';

try {
  console.log('Rendering App...');
  const html = renderToString(<App />);
  console.log('Render successful!', html.length);
} catch (e) {
  console.error('Render failed:', e);
}
