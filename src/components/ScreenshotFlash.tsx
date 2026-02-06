/**
 * Screenshot Flash Effect
 * Camera-like flash overlay when taking a screenshot
 */

import React from 'react';
import './ScreenshotFlash.css';

interface ScreenshotFlashProps {
  isVisible: boolean;
}

export const ScreenshotFlash: React.FC<ScreenshotFlashProps> = ({ isVisible }) => {
  if (!isVisible) return null;
  
  return <div className="screenshot-flash" />;
};
