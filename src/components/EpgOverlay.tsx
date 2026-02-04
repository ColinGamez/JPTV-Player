/**
 * EPG Overlay Component
 * 
 * Displays "Now / Next" programme information for the active channel.
 */

import React from 'react';
import { XmltvProgramme } from '../parser/xmltv-parser';
import { formatTime, getDurationMinutes } from '../parser/xmltv-parser';

interface EpgOverlayProps {
  current?: XmltvProgramme;
  next?: XmltvProgramme;
  visible: boolean;
}

export const EpgOverlay: React.FC<EpgOverlayProps> = ({ current, next, visible }) => {
  if (!visible || (!current && !next)) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '20px',
        right: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: '#ffffff',
        padding: '20px',
        borderRadius: '8px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        zIndex: 1000,
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {current && (
        <div style={{ marginBottom: next ? '16px' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span
              style={{
                backgroundColor: '#22c55e',
                color: '#000',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                marginRight: '10px',
              }}
            >
              NOW
            </span>
            <span style={{ fontSize: '14px', color: '#9ca3af' }}>
              {formatTime(current.start)} - {formatTime(current.stop)}
              <span style={{ marginLeft: '8px' }}>
                ({getDurationMinutes(current.start, current.stop)} min)
              </span>
            </span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '6px' }}>
            {current.title}
          </div>
          {current.description && (
            <div
              style={{
                fontSize: '14px',
                color: '#d1d5db',
                lineHeight: '1.5',
                maxHeight: '3em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {current.description}
            </div>
          )}
          {current.category && (
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
              {current.category}
            </div>
          )}
        </div>
      )}

      {next && (
        <div style={{ paddingTop: current ? '16px' : '0', borderTop: current ? '1px solid rgba(255, 255, 255, 0.1)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span
              style={{
                backgroundColor: '#3b82f6',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                marginRight: '10px',
              }}
            >
              NEXT
            </span>
            <span style={{ fontSize: '14px', color: '#9ca3af' }}>
              {formatTime(next.start)} - {formatTime(next.stop)}
              <span style={{ marginLeft: '8px' }}>
                ({getDurationMinutes(next.start, next.stop)} min)
              </span>
            </span>
          </div>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>
            {next.title}
          </div>
          {next.description && (
            <div
              style={{
                fontSize: '13px',
                color: '#d1d5db',
                lineHeight: '1.4',
                maxHeight: '2.8em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {next.description}
            </div>
          )}
          {next.category && (
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
              {next.category}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
