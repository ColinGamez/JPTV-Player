/**
 * Multi-View Layout Component
 * Renders multiple video feeds in grid/PiP layouts
 */

import React from 'react';
import type { MultiViewLayout, ViewSlot } from '../hooks/useMultiView';
import './MultiViewLayout.css';

interface MultiViewLayoutProps {
  layout: MultiViewLayout;
  slots: ViewSlot[];
  activeSlotId: number;
  onSlotClick: (slotId: number) => void;
  onSwapSlots: (slotA: number, slotB: number) => void;
  children?: React.ReactNode; // Main player renders here
}

export const MultiViewLayoutComponent: React.FC<MultiViewLayoutProps> = ({
  layout,
  slots,
  activeSlotId,
  onSlotClick,
  children,
}) => {
  if (layout === 'single') {
    return <div className="multiview-single">{children}</div>;
  }

  return (
    <div className={`multiview-container multiview-${layout}`}>
      {slots.map((slot, index) => (
        <div
          key={slot.id}
          className={`multiview-slot ${slot.isActive ? 'active' : ''} ${
            layout === 'pip' && index === 1 ? 'pip-slot' : ''
          }`}
          onClick={() => onSlotClick(slot.id)}
        >
          {index === 0 && children}
          {index > 0 && (
            <div className="slot-placeholder">
              {slot.channel ? (
                <div className="slot-info">
                  <span className="slot-channel">{slot.channel.name}</span>
                  {slot.isMuted && <span className="slot-muted">🔇</span>}
                </div>
              ) : (
                <div className="slot-empty">
                  <span className="slot-empty-icon">+</span>
                  <span className="slot-empty-text">Add Channel</span>
                </div>
              )}
            </div>
          )}
          <div className="slot-badge">
            {slot.isActive ? '🔊' : '🔇'} Slot {slot.id + 1}
          </div>
        </div>
      ))}
    </div>
  );
};
