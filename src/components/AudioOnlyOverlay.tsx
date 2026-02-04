import React from 'react';

interface AudioOnlyOverlayProps {
  visible: boolean;
}

export const AudioOnlyOverlay: React.FC<AudioOnlyOverlayProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '40px 60px',
        borderRadius: '12px',
        fontSize: '18px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        zIndex: 999,
        border: '2px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '40px',
          marginBottom: '8px'
        }}
      >
        🎵
      </div>
      <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
        Audio Only Mode
      </div>
      <div style={{ fontSize: '14px', opacity: 0.7, textAlign: 'center' }}>
        Video rendering disabled<br />
        Press 'A' to toggle
      </div>
    </div>
  );
};
