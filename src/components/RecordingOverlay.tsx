import React, { useState, useEffect } from 'react';
import type { RecordingInfo } from '../types/electron';

interface RecordingOverlayProps {
  recordingInfo: RecordingInfo | null;
  onStopRecording?: () => void;
}

export const RecordingOverlay: React.FC<RecordingOverlayProps> = ({ recordingInfo, onStopRecording }) => {
  const [duration, setDuration] = useState('00:00');

  // Update duration every second while recording
  useEffect(() => {
    if (!recordingInfo) {
      setDuration('00:00');
      return;
    }

    const updateDuration = () => {
      const elapsed = Math.floor((Date.now() - recordingInfo.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateDuration(); // Set immediately
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [recordingInfo]);

  if (!recordingInfo) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,245,245,0.95) 100%)',
        color: '#d14848',
        padding: '12px 18px',
        borderRadius: '16px',
        fontSize: '13px',
        fontFamily: 'Segoe UI, Meiryo, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        zIndex: 1000,
        pointerEvents: 'auto',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2), inset 0 2px 4px rgba(255, 255, 255, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.5)',
        border: '2px solid rgba(255, 200, 200, 0.6)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: '#ff4444',
          boxShadow: '0 0 8px rgba(255, 68, 68, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
          animation: 'pulse 2s ease-in-out infinite'
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>REC {duration}</div>
        <div style={{ fontSize: '11px', opacity: 0.8, color: '#a03030' }}>
          {recordingInfo.channelName}
        </div>
      </div>
      {onStopRecording && (
        <button
          onClick={onStopRecording}
          style={{
            marginLeft: '8px',
            padding: '6px 12px',
            background: 'linear-gradient(135deg, #ff4444 0%, #cc3333 100%)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '12px',
            color: 'white',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(255, 68, 68, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #ee3333 0%, #bb2222 100%)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #ff4444 0%, #cc3333 100%)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          STOP
        </button>
      )}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}
      </style>
    </div>
  );
};
