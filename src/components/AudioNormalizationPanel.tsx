import React, { useState } from 'react';
import type { AudioNormalizationSettings, ChannelAudioProfile } from '../types/audio-normalization';

interface AudioNormalizationPanelProps {
  settings: AudioNormalizationSettings;
  currentChannelProfile?: ChannelAudioProfile;
  onUpdateSettings: (settings: Partial<AudioNormalizationSettings>) => void;
  onSetUserGainOverride: (gain: number | undefined) => void;
  onResetProfile: () => void;
}

export const AudioNormalizationPanel: React.FC<AudioNormalizationPanelProps> = ({
  settings,
  currentChannelProfile,
  onUpdateSettings,
  onSetUserGainOverride,
  onResetProfile
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customGain, setCustomGain] = useState<string>(
    currentChannelProfile?.userGainOverride?.toString() ?? '0'
  );

  const handleToggle = () => {
    onUpdateSettings({ enabled: !settings.enabled });
  };

  const handleApplyCustomGain = () => {
    const gain = parseFloat(customGain);
    if (!isNaN(gain)) {
      onSetUserGainOverride(gain);
    }
  };

  const handleResetCustomGain = () => {
    onSetUserGainOverride(undefined);
    setCustomGain('0');
  };

  const currentGain = currentChannelProfile 
    ? (currentChannelProfile.userGainOverride ?? 
       (settings.targetLevel - currentChannelProfile.averageLevel))
    : 0;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(245,250,255,0.95) 100%)',
      border: '3px solid rgba(200, 220, 245, 0.6)',
      borderRadius: '20px',
      padding: isExpanded ? '20px' : '12px 18px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2), inset 0 2px 4px rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(10px)',
      zIndex: 900,
      maxWidth: isExpanded ? '320px' : 'auto',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {/* Header with toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: isExpanded ? '15px' : '0'
      }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: 'linear-gradient(135deg, #4a9eff 0%, #3d85d8 100%)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '12px',
            color: 'white',
            padding: '8px 14px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(74, 158, 255, 0.4)',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          🔊 {isExpanded ? '▼' : '▶'}
        </button>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <label style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#2b5a8e',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={handleToggle}
              style={{ marginRight: '6px' }}
            />
            Auto-Normalize
          </label>
          
          {currentChannelProfile && settings.enabled && (
            <span style={{
              fontSize: '12px',
              color: currentGain > 0 ? '#22c55e' : currentGain < 0 ? '#d14848' : '#5580b0',
              fontWeight: 'bold',
              padding: '2px 8px',
              background: 'rgba(255,255,255,0.6)',
              borderRadius: '8px'
            }}>
              {currentGain > 0 ? '+' : ''}{currentGain.toFixed(1)} dB
            </span>
          )}
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {/* Current channel info */}
          {currentChannelProfile && (
            <div style={{
              padding: '10px',
              background: 'rgba(240,250,255,0.8)',
              borderRadius: '12px',
              fontSize: '12px'
            }}>
              <div style={{ 
                fontWeight: 'bold', 
                color: '#2b5a8e',
                marginBottom: '6px' 
              }}>
                Current Channel
              </div>
              <div style={{ color: '#5580b0' }}>
                Avg Level: {currentChannelProfile.averageLevel.toFixed(1)} dB
              </div>
              <div style={{ color: '#5580b0' }}>
                Samples: {currentChannelProfile.sampleCount}
              </div>
              {currentChannelProfile.userGainOverride !== undefined && (
                <div style={{ 
                  color: '#ff9500',
                  fontWeight: 'bold',
                  marginTop: '4px'
                }}>
                  ⚠️ Manual Override Active
                </div>
              )}
            </div>
          )}

          {/* Custom gain control */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <label style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#2b5a8e'
            }}>
              Manual Gain Adjustment
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="number"
                value={customGain}
                onChange={(e) => setCustomGain(e.target.value)}
                step="0.5"
                min="-12"
                max="12"
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  border: '2px solid rgba(200, 220, 245, 0.6)',
                  borderRadius: '10px',
                  fontSize: '13px',
                  background: 'white'
                }}
              />
              <button
                onClick={handleApplyCustomGain}
                style={{
                  padding: '6px 12px',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Apply
              </button>
            </div>
            <button
              onClick={handleResetCustomGain}
              style={{
                padding: '6px 12px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Reset to Auto
            </button>
          </div>

          {/* Reset profile button */}
          {currentChannelProfile && (
            <button
              onClick={onResetProfile}
              style={{
                padding: '8px 12px',
                background: 'linear-gradient(135deg, #d14848 0%, #b03838 100%)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Reset Channel Profile
            </button>
          )}

          {/* Settings */}
          <div style={{
            padding: '10px',
            background: 'rgba(240,250,255,0.6)',
            borderRadius: '12px',
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ 
              fontWeight: 'bold', 
              color: '#2b5a8e',
              marginBottom: '4px'
            }}>
              Settings
            </div>
            <div style={{ color: '#5580b0' }}>
              Target: {settings.targetLevel} dB LUFS
            </div>
            <div style={{ color: '#5580b0' }}>
              Max Adjustment: ±{settings.maxGainAdjustment} dB
            </div>
            <div style={{ color: '#5580b0' }}>
              Sample Rate: {settings.samplingInterval}ms
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};
