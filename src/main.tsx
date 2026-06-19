import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuraSealApp } from './app/AuraSealApp';
import { ErrorBoundary } from './app/ErrorBoundary';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuraSealApp />
    </ErrorBoundary>
  </StrictMode>,
);
