import { useState, useEffect, useCallback, useRef } from 'react';
import { mockChannels, mockCategories } from './data/mockData';
import type { Channel as MockChannel } from './data/mockData';
import type { Channel } from './types/channel';
import type { ProfileSession } from './types/profile';
import { useProfile } from './contexts/ProfileContext';
import { useProfileSettings } from './hooks/useProfileSettings';
import { usePlaylist } from './hooks/usePlaylist';
import { usePlaybackState } from './hooks/usePlaybackState';
import { useChannelHistory, saveLastChannel, findChannelById, findChannelByNumber } from './hooks/useChannelHistory';
import { useNumericInput } from './hooks/useNumericInput';
import { useEpgData } from './hooks/useEpgData';
import { useChannelFallback } from './hooks/useChannelFallback';
import { useRecording } from './hooks/useRecording';
import { useAudioOnly } from './hooks/useAudioOnly';
import { useProfileAudioNormalization } from './hooks/useProfileAudioNormalization';
import { useParentalLock } from './hooks/useParentalLock';
import { useUIAutoHide } from './hooks/useUIAutoHide';
import { useFullscreen } from './hooks/useFullscreen';
import { VlcPlayerAdapter } from './player/VlcPlayerAdapter';
import CategoryRail from './components/CategoryRail';
import ChannelList from './components/ChannelList';
import Player from './components/Player';
import InfoOverlay from './components/InfoOverlay';
import { RecordingOverlay } from './components/RecordingOverlay';
import { AudioOnlyOverlay } from './components/AudioOnlyOverlay';
import { AudioNormalizationPanel } from './components/AudioNormalizationPanel';
import { NowNextOverlay } from './components/NowNextOverlay';
import { FullGuideGrid } from './components/FullGuideGrid';
import { ParentalLockOverlay } from './components/ParentalLockOverlay';
import { ParentalLockSettings } from './components/ParentalLockSettings';
import { DonationJar } from './components/DonationJar';
import styles from './App.module.css';

type FocusArea = 'categories' | 'channels' | 'player';

const playerAdapter = new VlcPlayerAdapter();

interface AppProps {
  profileSession: ProfileSession;
}

function App({ profileSession }: AppProps) {
  const profile = useProfile();
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [selectedChannel, setSelectedChannel] = useState<Channel | MockChannel | null>(null);
  const [focusArea, setFocusArea] = useState<FocusArea>('categories');
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [channelIndex, setChannelIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [showNowNext, setShowNowNext] = useState(false);
  const [showFullGuide, setShowFullGuide] = useState(false);
  const [showParentalLockOverlay, setShowParentalLockOverlay] = useState(false);
  const [showParentalLockSettings, setShowParentalLockSettings] = useState(false);
  const [showDonationJar, setShowDonationJar] = useState(false);
  const [pendingLockAction, setPendingLockAction] = useState<{ type: 'category' | 'channel', id: string, callback: () => void } | null>(null);
  const hasRestoredChannel = useRef(false);
  const lastNavigationTime = useRef<number>(0);
  const navigationThrottle = 100; // ms between navigation events

  const { settings, updateSetting, toggleFavorite, updateProfileData, isElectron } = useProfileSettings(profileSession);
  const { openPlaylist, playlistPath, channels, categories, parseError } = usePlaylist();
  const { playbackInfo, updateState, clearError } = usePlaybackState();
  const { addToHistory, getPreviousChannel } = useChannelHistory(settings, updateSetting);
  const { nowNext, channels: epgChannels, stats, loading: epgLoading, loadXmltvFile, refreshNowNext } = useEpgData();
  const { playChannelWithFallback } = useChannelFallback();
  const { isRecording, recordingInfo, startRecording, stopRecording } = useRecording(
    selectedChannel ? String(selectedChannel.id) : undefined
  );
  const { audioOnlyMode, toggleAudioOnly } = useAudioOnly();
  const audioNormalization = useProfileAudioNormalization(profileSession, updateProfileData);
  const parentalLock = useParentalLock();
  
  // TV Mode: UI auto-hide with keyboard-only wake
  const { isUIVisible, showUI, hideUI, resetTimer } = useUIAutoHide(5000);
  
  // TV Mode: Fullscreen management with profile persistence
  const { isFullscreen, toggleFullscreen, setFullscreen } = useFullscreen({
    profileSession,
    updateProfileData,
    isElectron
  });

  // Parental lock check helper
  const checkParentalLock = useCallback((type: 'category' | 'channel', id: string, callback: () => void) => {
    if (parentalLock.isLocked(type, id)) {
      setPendingLockAction({ type, id, callback });
      setShowParentalLockOverlay(true);
      return false; // Blocked
    }
    callback();
    return true; // Allowed
  }, [parentalLock]);

  const handleUnlockSuccess = useCallback(async (pin: string) => {
    const success = await parentalLock.requestUnlock(pin);
    if (success && pendingLockAction) {
      setShowParentalLockOverlay(false);
      pendingLockAction.callback();
      setPendingLockAction(null);
    }
    return success;
  }, [parentalLock, pendingLockAction]);

  const handleUnlockCancel = useCallback(() => {
    setShowParentalLockOverlay(false);
    setPendingLockAction(null);
  }, []);

  // Periodic profile data save (every 30 seconds)
  useEffect(() => {
    if (!isElectron) return;

    let consecutiveSaveFailures = 0;
    const MAX_SAVE_FAILURES = 3;

    const saveInterval = setInterval(async () => {
      try {
        await window.electron.profile.save();
        consecutiveSaveFailures = 0; // Reset on success
        console.log('[App] Auto-saved profile data');
      } catch (err) {
        consecutiveSaveFailures++;
        console.error('[App] Auto-save failed:', err);
        
        // Alert user if persistent save failures (disk full, permissions, etc.)
        if (consecutiveSaveFailures >= MAX_SAVE_FAILURES) {
          console.error('[App] CRITICAL: Multiple save failures detected. Profile data may not persist!');
          // In production, could show UI notification here
        }
      }
    }, 30000); // 30 seconds

    return () => clearInterval(saveInterval);
  }, [isElectron]);

  // TV Mode: Clean shutdown on window close
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (isElectron && selectedChannel) {
        try {
          // Stop playback cleanly
          console.log('[TV Mode] Stopping playback for shutdown');
          await playerAdapter.stop();
          
          // Save last channel
          await saveLastChannel(selectedChannel, channelIndex, updateSetting);
          
          // Save fullscreen state (already persisted by useFullscreen hook)
          
          // Save audio-only mode if applicable
          if (audioOnlyMode) {
            await updateProfileData({ audioOnlyMode: true });
          }
          
          // Save profile
          await window.electron.profile.save();
          console.log('[TV Mode] Clean shutdown complete');
        } catch (err) {
          console.error('[TV Mode] Shutdown error:', err);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isElectron, selectedChannel, channelIndex, updateSetting, audioOnlyMode, updateProfileData]);

  // Setup player state callback
  useEffect(() => {
    playerAdapter.onStateChange((state) => {
      updateState(state, selectedChannel?.name);
    });
  }, [selectedChannel, updateState]);

  // Use parsed channels if available, otherwise use mock data
  const activeChannels = channels.length > 0 ? channels : mockChannels;
  const activeCategories = channels.length > 0 
    ? [
        { name: 'すべて', count: channels.length },
        ...Object.keys(categories).map(cat => ({
          name: cat,
          count: categories[cat].length
        }))
      ]
    : mockCategories;

  const filteredChannels = selectedCategory === 'すべて'
    ? activeChannels
    : channels.length > 0
      ? (categories[selectedCategory] || [])
      : mockChannels.filter(c => c.category === selectedCategory);

  // Numeric input handling
  const handleNumericChannelSelect = useCallback(async (number: number) => {
    const result = findChannelByNumber(filteredChannels, number);
    if (result) {
      const channelId = String(result.channel.id);
      
      checkParentalLock('channel', channelId, async () => {
        setChannelIndex(result.index);
        setSelectedChannel(result.channel);
        
        // Save to history
        saveLastChannel(result.channel, result.index, updateSetting);
        addToHistory(channelId);
      
      // Play channel with fallback support
      clearError();
      updateState('buffering', result.channel.name);
      
      const playResult = await playChannelWithFallback(result.channel);
      if (playResult.success) {
        // Switch audio normalization to new channel
        const channelId = String(result.channel.id);
        audioNormalization.switchChannel(channelId).catch(err => {
          console.warn('[AudioNormalization] Failed to switch channel:', err);
        });
        
        setFocusArea('player');
        setShowInfo(true);
        setTimeout(() => setShowInfo(false), 3000);
      } else {
        updateState('error', result.channel.name, playResult.error || 'All URLs failed');
        setTimeout(() => clearError(), 5000);
      }
      });
    }
  }, [filteredChannels, updateSetting, addToHistory, playChannelWithFallback, updateState, clearError, checkParentalLock]);

  const { inputBuffer, isInputMode, handleKeyPress: handleNumericKeyPress } = useNumericInput(handleNumericChannelSelect);

  // TV Mode: Auto-play last channel on launch
  useEffect(() => {
    if (!hasRestoredChannel.current && channels.length > 0 && settings.lastChannelId) {
      hasRestoredChannel.current = true;
      
      const result = findChannelById(activeChannels, settings.lastChannelId);
      if (result) {
        console.log(`[TV Mode] Auto-playing last channel: ${result.channel.name}`);
        setSelectedChannel(result.channel);
        setChannelIndex(result.index);
        
        // TV Mode: Auto-play channel immediately
        const autoPlay = async () => {
          clearError();
          updateState('buffering', result.channel.name);
          
          const playResult = await playChannelWithFallback(result.channel);
          if (playResult.success) {
            const channelId = String(result.channel.id);
            audioNormalization.switchChannel(channelId).catch(err => {
              console.warn('[AudioNormalization] Failed to switch channel:', err);
            });
            
            setFocusArea('player');
            setShowInfo(true);
            setTimeout(() => setShowInfo(false), 5000);
          } else {
            updateState('error', result.channel.name, playResult.error || 'All URLs failed');
            setTimeout(() => clearError(), 5000);
          }
        };
        
        autoPlay();
      } else {
        // Channel not found - fallback to first available channel
        console.warn('[TV Mode] Last channel not found, falling back to first channel');
        if (activeChannels.length > 0) {
          const firstChannel = activeChannels[0];
          setSelectedChannel(firstChannel);
          setChannelIndex(0);
          
          const autoPlayFirst = async () => {
            clearError();
            updateState('buffering', firstChannel.name);
            
            const playResult = await playChannelWithFallback(firstChannel);
            if (playResult.success) {
              const channelId = String(firstChannel.id);
              audioNormalization.switchChannel(channelId).catch(err => {
                console.warn('[AudioNormalization] Failed to switch channel:', err);
              });
              
              setFocusArea('player');
              setShowInfo(true);
              setTimeout(() => {
                setShowInfo(false);
              }, 5000);
              
              // Save new last channel
              saveLastChannel(firstChannel, 0, updateSetting);
            } else {
              updateState('error', firstChannel.name, playResult.error || 'Playback failed');
              setTimeout(() => clearError(), 5000);
            }
          };
          
          autoPlayFirst();
        }
      }
    }
  }, [channels, settings.lastChannelId, activeChannels, playChannelWithFallback, updateState, clearError, audioNormalization, updateSetting]);

  useEffect(() => {
    if (parseError) {
      console.error('Playlist parse error:', parseError);
      alert(`Failed to parse playlist: ${parseError}`);
    }
  }, [parseError]);

  useEffect(() => {
    if (channels.length > 0) {
      console.log(`Loaded ${channels.length} channels from playlist`);
      // Don't reset if restoring last channel
      if (!hasRestoredChannel.current) {
        setCategoryIndex(0);
        setChannelIndex(0);
        setSelectedCategory('すべて');
      }
    }
  }, [channels]);

  // Cleanup audio normalization monitoring on unmount
  useEffect(() => {
    return () => {
      audioNormalization.stopMonitoring();
    };
  }, [audioNormalization]);

  // Listen for menu events (Donate from Help menu)
  useEffect(() => {
    if (!isElectron) return;

    const handleMenuOpenDonation = () => {
      setShowDonationJar(true);
    };

    // Listen for IPC events from menu
    const ipcRenderer = (window as any).electron?.ipcRenderer;
    if (ipcRenderer) {
      ipcRenderer.on('menu:openDonation', handleMenuOpenDonation);
      
      return () => {
        ipcRenderer.removeListener('menu:openDonation', handleMenuOpenDonation);
      };
    }
  }, [isElectron]);

  // Refresh EPG now/next when channel changes
  useEffect(() => {
    if (selectedChannel && stats.loaded) {
      const channelId = String(selectedChannel.id);
      refreshNowNext([channelId]);
    }
  }, [selectedChannel, stats.loaded, refreshNowNext]);

  // Window focus/restore handler - show UI briefly when app regains focus
  useEffect(() => {
    const handleFocus = () => {
      console.log('[TV Mode] Window focused, showing UI');
      showUI();
      resetTimer();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [showUI, resetTimer]);

  // Handle profile changes (logout/switch)
  useEffect(() => {
    const unsubscribe = profile.onProfileChange(async (newSession, oldSession) => {
      console.log('[App] Profile change detected:', {
        old: oldSession?.profile.name,
        new: newSession?.profile.name,
      });

      // Stop playback
      if (selectedChannel) {
        console.log('[App] Stopping playback due to profile change');
        try {
          await playerAdapter.stop();
        } catch (err) {
          console.error('[App] Failed to stop playback:', err);
        }
      }

      // Stop audio monitoring
      audioNormalization.stopMonitoring();
      
      // Save last channel for old profile
      if (oldSession && selectedChannel) {
        console.log('[App] Saving last channel for old profile');
        try {
          await saveLastChannel(selectedChannel, channelIndex, updateSetting);
        } catch (err) {
          console.error('[App] Failed to save last channel:', err);
        }
      }

      // Clear runtime state
      setSelectedChannel(null);
      setChannelIndex(0);
      setCategoryIndex(0);
      setSelectedCategory('すべて');
      setShowInfo(false);
      setShowNowNext(false);
      setShowFullGuide(false);
      hasRestoredChannel.current = false;

      console.log('[App] Profile change cleanup complete');
    });

    return unsubscribe;
  }, [profile, selectedChannel, channelIndex, audioNormalization, updateSetting]);

  // Restore last channel when profile loads
  useEffect(() => {
    if (!hasRestoredChannel.current && channels.length > 0 && settings.lastChannelId) {
      console.log('[App] Restoring last channel:', settings.lastChannelId);
      
      const result = findChannelById(channels, settings.lastChannelId);
      if (result) {
        setSelectedChannel(result.channel);
        setChannelIndex(result.index);
        
        // Restore last category if available
        if (settings.lastCategory) {
          setSelectedCategory(settings.lastCategory);
        }
        
        hasRestoredChannel.current = true;
        console.log('[App] Last channel restored:', result.channel.name);
        
        // Auto-play last channel
        clearError();
        updateState('buffering', result.channel.name);
        playChannelWithFallback(result.channel).then(playResult => {
          if (!playResult.success) {
            console.error('[App] Failed to play last channel:', playResult.error);
          } else {
            // Start audio monitoring
            const channelId = String(result.channel.id);
            audioNormalization.switchChannel(channelId);
          }
        });
      } else {
        console.warn('[App] Last channel not found in playlist');
        hasRestoredChannel.current = true;
      }
    }
  }, [channels, settings.lastChannelId, settings.lastCategory, audioNormalization, playChannelWithFallback, clearError, updateState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // TV Mode: Show UI on any key press
      showUI();
      resetTimer();

      // F11 for fullscreen toggle
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // Ctrl+D for donation jar
      if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setShowDonationJar(prev => !prev);
        return;
      }

      // Ctrl+Shift+P for parental lock settings
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setShowParentalLockSettings(prev => !prev);
        return;
      }

      // Try numeric input first
      if (handleNumericKeyPress(e.key)) {
        e.preventDefault();
        return;
      }

      e.preventDefault();

      // TV Mode: ESC hides overlays, returns to playback
      if (e.key === 'Escape') {
        if (showDonationJar) {
          setShowDonationJar(false);
          return;
        }
        if (showParentalLockSettings) {
          setShowParentalLockSettings(false);
          return;
        }
        if (showFullGuide) {
          setShowFullGuide(false);
          return;
        }
        if (showNowNext) {
          setShowNowNext(false);
          return;
        }
        if (showInfo) {
          setShowInfo(false);
          return;
        }
        
        // Return to playback
        setFocusArea('player');
        return;
      }

      if (e.key === 'i' || e.key === 'I') {
        setShowInfo(prev => !prev);
        return;
      }

      if (e.key === 'e' || e.key === 'E') {
        setShowNowNext(prev => !prev);
        if (selectedChannel && !showNowNext) {
          const channelId = String(selectedChannel.id);
          refreshNowNext([channelId]);
        }
        return;
      }

      if (e.key === 'g' || e.key === 'G') {
        setShowFullGuide(prev => !prev);
        return;
      }

      if (e.key === 'l' || e.key === 'L') {
        if (isElectron) {
          loadXmltvFile();
        }
        return;
      }

      if (e.key === 'o' || e.key === 'O') {
        if (isElectron) {
          openPlaylist();
        }
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        if (selectedChannel) {
          const channelId = typeof selectedChannel.id === 'string'
            ? parseInt(selectedChannel.id, 16) || 0
            : selectedChannel.id;
          toggleFavorite(channelId);
        }
        return;
      }

      if (focusArea === 'categories') {
        handleCategoryNavigation(e.key);
      } else if (focusArea === 'channels') {
        handleChannelNavigation(e.key);
      } else if (focusArea === 'player') {
        handlePlayerNavigation(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusArea, categoryIndex, channelIndex, filteredChannels.length, selectedChannel, isElectron, showDonationJar, showParentalLockSettings, showFullGuide, showNowNext, showInfo, showUI, resetTimer, toggleFullscreen]);

  const handleCategoryNavigation = useCallback((key: string) => {
    // Throttle navigation to prevent hold-down spam
    const now = Date.now();
    if (now - lastNavigationTime.current < navigationThrottle) {
      return;
    }
    lastNavigationTime.current = now;

    if (key === 'ArrowUp') {
      setCategoryIndex(prev => Math.max(0, prev - 1));
    } else if (key === 'ArrowDown') {
      setCategoryIndex(prev => Math.min(activeCategories.length - 1, prev + 1));
    } else if (key === 'Enter') {
      const categoryName = activeCategories[categoryIndex].name;
      checkParentalLock('category', categoryName, () => {
        setSelectedCategory(categoryName);
        setChannelIndex(0);
        setFocusArea('channels');
      });
    } else if (key === 'ArrowRight') {
      setFocusArea('channels');
    }
  }, [categoryIndex, activeCategories, checkParentalLock]);

  const handleChannelNavigation = useCallback((key: string) => {
    // Throttle navigation to prevent hold-down spam
    const now = Date.now();
    if (now - lastNavigationTime.current < navigationThrottle) {
      return;
    }
    lastNavigationTime.current = now;

    if (key === 'ArrowUp') {
      setChannelIndex(prev => Math.max(0, prev - 1));
    } else if (key === 'ArrowDown') {
      setChannelIndex(prev => Math.min(filteredChannels.length - 1, prev + 1));
    } else if (key === 'ArrowLeft') {
      setFocusArea('categories');
    } else if (key === 'Enter') {
      const channel = filteredChannels[channelIndex];
      const channelId = String(channel.id);
      
      checkParentalLock('channel', channelId, () => {
        setSelectedChannel(channel);
        
        // Save to history and last channel + category
        saveLastChannel(channel, channelIndex, updateSetting);
        addToHistory(channelId);
      
      // Persist last category
      updateSetting('lastCategory', selectedCategory).catch(err => {
        console.error('[App] Failed to save last category:', err);
      });
      
      // Play channel with fallback support and error handling
      clearError();
      updateState('buffering', channel.name);
      
      playChannelWithFallback(channel)
        .then((result) => {
          if (result.success) {
            // Switch audio normalization to new channel
            const channelId = String(channel.id);
            audioNormalization.switchChannel(channelId).catch(err => {
              console.warn('[AudioNormalization] Failed to switch channel:', err);
            });
            
            setFocusArea('player');
            setShowInfo(true);
            setTimeout(() => setShowInfo(false), 3000);
          } else {
            console.error('[App] Playback failed:', result.error);
            updateState('error', channel.name, result.error || 'All URLs failed');
            setTimeout(() => clearError(), 5000);
          }
        })
        .catch((error) => {
          console.error('[App] Playback error:', error);
          updateState('error', channel.name, error.message || 'Failed to play stream');
          // Show error for 5 seconds
          setTimeout(() => clearError(), 5000);
        });
      });
    }
  }, [channelIndex, filteredChannels, updateSetting, updateState, clearError, addToHistory, playChannelWithFallback, checkParentalLock]);

  const handlePlayerNavigation = useCallback((key: string) => {
    if (key === 'r' || key === 'R') {
      // Toggle recording (dev mode only)
      if (import.meta.env.DEV && selectedChannel) {
        const channelId = String(selectedChannel.id);
        if (isRecording) {
          stopRecording(channelId);
        } else {
          startRecording(channelId, selectedChannel.name);
        }
      }
    } else if (key === 'a' || key === 'A') {
      // Toggle audio-only mode
      toggleAudioOnly();
    } else if (key === 'ArrowUp') {
      playerAdapter.getVolume().then(vol => {
        const newVol = Math.min(100, vol + 5);
        playerAdapter.setVolume(newVol);
        updateSetting('volume', newVol);
      });
    } else if (key === 'ArrowDown') {
      playerAdapter.getVolume().then(vol => {
        const newVol = Math.max(0, vol - 5);
        playerAdapter.setVolume(newVol);
        updateSetting('volume', newVol);
      });
    } else if (key === ' ') {
      if (playerAdapter.isPlaying()) {
        playerAdapter.pause();
      } else {
        playerAdapter.resume();
      }
    }
  }, [updateSetting, selectedChannel, isRecording, startRecording, stopRecording, toggleAudioOnly]);

  return (
    <div className={styles.app}>
      {/* TV Mode: Category rail and channel list auto-hide */}
      {isUIVisible && (
        <>
          <CategoryRail
            categories={activeCategories}
            selectedIndex={categoryIndex}
            focused={focusArea === 'categories'}
          />
          <ChannelList
            channels={filteredChannels}
            selectedIndex={channelIndex}
            focused={focusArea === 'channels'}
            favorites={settings.favorites}
          />
        </>
      )}
      
      <Player channel={selectedChannel} />
      
      {/* Playback state indicator */}
      {(playbackInfo.state === 'buffering' || playbackInfo.state === 'error') && (
        <div className={styles.playbackOverlay}>
          {playbackInfo.state === 'buffering' && (
            <div className={styles.bufferingIndicator}>
              <div className={styles.spinner}></div>
              <p>Buffering...</p>
            </div>
          )}
          {playbackInfo.state === 'error' && playbackInfo.error && (
            <div className={styles.errorIndicator}>
              <p>⚠ Playback failed</p>
              <p className={styles.errorMessage}>{playbackInfo.error}</p>
            </div>
          )}
        </div>
      )}
      
      {showInfo && selectedChannel && (
        <InfoOverlay 
          channel={selectedChannel}
          isFavorite={settings.favorites.includes(
            typeof selectedChannel.id === 'string' 
              ? parseInt(selectedChannel.id, 16) || 0 
              : selectedChannel.id
          )}
          playlistPath={playlistPath}
        />
      )}
      
      {/* Now/Next EPG overlay */}
      {selectedChannel && (
        <NowNextOverlay
          channelId={String(selectedChannel.id)}
          channelName={selectedChannel.name}
          nowNext={nowNext.get(String(selectedChannel.id)) || null}
          visible={showNowNext}
          onHide={() => setShowNowNext(false)}
        />
      )}
      
      {/* Full EPG guide grid */}
      <FullGuideGrid
        channels={epgChannels}
        visible={showFullGuide}
        onClose={() => setShowFullGuide(false)}
      />
      
      {/* Recording overlay - dev mode only */}
      {import.meta.env.DEV && recordingInfo && (
        <RecordingOverlay
          recordingInfo={recordingInfo}
          onStopRecording={() => selectedChannel && stopRecording(String(selectedChannel.id))}
        />
      )}
      
      {/* Audio normalization panel - dev mode */}
      {import.meta.env.DEV && isElectron && (
        <AudioNormalizationPanel
          settings={audioNormalization.settings}
          currentChannelProfile={
            selectedChannel 
              ? audioNormalization.getChannelProfile(String(selectedChannel.id))
              : undefined
          }
          onUpdateSettings={audioNormalization.updateSettings}
          onSetUserGainOverride={(gain) => {
            if (selectedChannel) {
              audioNormalization.setUserGainOverride(String(selectedChannel.id), gain);
            }
          }}
          onResetProfile={() => {
            if (selectedChannel) {
              audioNormalization.resetChannelProfile(String(selectedChannel.id));
            }
          }}
        />
      )}
      
      {/* Audio-only mode overlay - disabled (requires VLC SDK) */}
      {/* <AudioOnlyOverlay visible={audioOnlyMode} /> */}
      
      {/* Parental Lock Overlay */}
      {showParentalLockOverlay && (
        <ParentalLockOverlay
          onUnlock={handleUnlockSuccess}
          onCancel={handleUnlockCancel}
          title={pendingLockAction?.type === 'category' ? 'Category Locked' : 'Channel Locked'}
        />
      )}
      
      {/* Parental Lock Settings */}
      {showParentalLockSettings && (
        <ParentalLockSettings
          onClose={() => setShowParentalLockSettings(false)}
          channels={activeChannels.map(ch => ({
            id: String(ch.id),
            name: ch.name,
            category: 'group' in ch ? ch.group : (ch as MockChannel).category
          }))}
        />
      )}

      {/* Donation Jar */}
      <DonationJar
        isOpen={showDonationJar}
        onClose={() => setShowDonationJar(false)}
      />
    </div>
  );
}

export default App;
