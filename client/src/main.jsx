import React from 'react'; // Changed from StrictMode to React
import { createRoot } from 'react-dom/client';
import './index.css'; // This is Vite's default index.css, keep it for now or ensure its contents are in App.css
import App from './App.jsx';

// App.jsx already imports client/src/assets/css/App.css which contains the main global styles and :root variables.
// The comprehensive reset from client/src/assets/css/index.css has been merged into client/src/assets/css/App.css.

createRoot(document.getElementById('root')).render(
  <React.StrictMode> {/* It's good practice to keep StrictMode */}
    <App />
  </React.StrictMode>,
);