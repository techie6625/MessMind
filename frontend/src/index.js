/*
  index.js — React Entry Point
  This file bootstraps the React app by rendering the <App> component
  into the <div id="root"> in public/index.html.
  React.StrictMode helps catch potential issues during development.
*/
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Load Tailwind CSS
import App from './App';

// Create a React root attached to the #root DOM element
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render our main App component inside StrictMode
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
