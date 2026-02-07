/**
 * Toast Container Component
 * Displays toast notifications
 */

import React, { useEffect, useState, useRef } from 'react';
import type { Toast } from '../hooks/useToast';
import './ToastContainer.css';

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [isLeaving, setIsLeaving] = useState(false);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const handleDismiss = () => {
    setIsLeaving(true);
    dismissTimerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, 300); // Match animation duration
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return 'ℹ';
    }
  };

  return (
    <div
      className={`toast toast-${toast.type} ${isLeaving ? 'toast-leaving' : ''}`}
      onClick={handleDismiss}
    >
      <div className="toast-icon">{getIcon()}</div>
      <div className="toast-message">{toast.message}</div>
      <button className="toast-close" onClick={(e) => { e.stopPropagation(); handleDismiss(); }} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
};
