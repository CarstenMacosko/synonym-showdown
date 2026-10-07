import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/patrick-hand';
import '@fontsource/gochi-hand';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
