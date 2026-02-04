/**
 * ProfileApp - Profile-aware IPTV Application
 * 
 * Top-level app component that handles profile authentication flow.
 * Shows profile selection screen before main app.
 */

import React, { useState, useEffect } from 'react';
import { ProfileProvider, useProfile } from './contexts/ProfileContext';
import { ProfileSelect } from './components/ProfileSelect';
import { PinEntry } from './components/PinEntry';
import { CreateProfile } from './components/CreateProfile';
import type { Profile } from './types/profile';
import App from './App';

enum AppState {
  Initializing = 'initializing',  // New: TV mode auto-login attempt
  ProfileSelect = 'select',
  PinEntry = 'pin',
  CreateProfile = 'create',
  Authenticated = 'authenticated',
}

const ProfileApp: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Initializing);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [lastActiveProfileId, setLastActiveProfileId] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  const profile = useProfile();

  // TV Mode: Auto-login to last used profile without PIN
  useEffect(() => {
    if (autoLoginAttempted || appState !== AppState.Initializing) return;

    const attemptAutoLogin = async () => {
      try {
        const lastId = await window.electron.profile.getLastActive();
        setLastActiveProfileId(lastId);

        if (lastId && profile.profiles.length > 0) {
          const lastProfile = profile.profiles.find(p => p.id === lastId);
          
          // Validate profile exists and is not corrupted
          if (!lastProfile) {
            console.warn('[TV Mode] Last profile not found, may have been deleted');
            setAppState(AppState.ProfileSelect);
            setAutoLoginAttempted(true);
            return;
          }
          
          if (lastProfile && !lastProfile.hasPin) {
            // Auto-login to last profile (TV mode behavior)
            console.log('[TV Mode] Auto-login to last profile:', lastProfile.name);
            
            try {
              await profile.login({ profileId: lastProfile.id });
              setAppState(AppState.Authenticated);
            } catch (loginError) {
              console.error('[TV Mode] Auto-login failed:', loginError);
              // Fallback to profile select on login error (corrupted profile data, etc.)
              setAppState(AppState.ProfileSelect);
            }
            
            setAutoLoginAttempted(true);
            return;
          }
        }

        // Fallback: No auto-login possible, show profile selection
        setAppState(AppState.ProfileSelect);
        setAutoLoginAttempted(true);
      } catch (err) {
        console.error('[TV Mode] Auto-login failed:', err);
        setAppState(AppState.ProfileSelect);
        setAutoLoginAttempted(true);
      }
    };

    // Wait for profiles to load with timeout
    const timeoutId = setTimeout(() => {
      if (!autoLoginAttempted && appState === AppState.Initializing) {
        console.warn('[TV Mode] Auto-login timeout, showing profile select');
        setAppState(AppState.ProfileSelect);
        setAutoLoginAttempted(true);
      }
    }, 5000); // 5 second timeout

    if (profile.profiles.length > 0 || profile.loading === false) {
      attemptAutoLogin();
      clearTimeout(timeoutId);
    }

    return () => clearTimeout(timeoutId);
  }, [profile.profiles, profile.loading, autoLoginAttempted, appState, profile]);

  // Load last active profile on mount (kept for fallback)
  useEffect(() => {
    if (lastActiveProfileId) return;

    const loadLastActive = async () => {
      try {
        const lastId = await window.electron.profile.getLastActive();
        setLastActiveProfileId(lastId);
      } catch (err) {
        console.error('[ProfileApp] Failed to load last active profile:', err);
      }
    };

    loadLastActive();
  }, [lastActiveProfileId]);

  // Handle profile selection
  const handleSelectProfile = async (profile: Profile) => {
    setSelectedProfile(profile);
    setPinError(null);

    if (profile.hasPin) {
      // Require PIN entry
      setAppState(AppState.PinEntry);
    } else {
      // Login without PIN
      try {
        await profile.login({ profileId: profile.id });
        setAppState(AppState.Authenticated);
      } catch (err) {
        console.error('[ProfileApp] Login failed:', err);
        setPinError(err instanceof Error ? err.message : 'Login failed');
      }
    }
  };

  // Handle PIN submission
  const handlePinSubmit = async (pin: string) => {
    if (!selectedProfile) return;

    try {
      await profile.login({ profileId: selectedProfile.id, pin });
      setPinError(null);
      setAppState(AppState.Authenticated);
    } catch (err) {
      console.error('[ProfileApp] PIN login failed:', err);
      setPinError(err instanceof Error ? err.message : 'Invalid PIN');
    }
  };

  // Handle PIN cancel
  const handlePinCancel = () => {
    setSelectedProfile(null);
    setPinError(null);
    setAppState(AppState.ProfileSelect);
  };

  // Handle create profile
  const handleCreateProfile = async (name: string, pin?: string, avatar?: string) => {
    setCreateError(null);

    try {
      const newProfile = await profile.createProfile({ name, pin, avatar });
      
      // Auto-login to new profile
      await profile.login({ 
        profileId: newProfile.id, 
        pin: pin 
      });
      
      setAppState(AppState.Authenticated);
    } catch (err) {
      console.error('[ProfileApp] Create profile failed:', err);
      setCreateError(err instanceof Error ? err.message : 'Failed to create profile');
    }
  };

  // Handle delete profile
  const handleDeleteProfile = async (profileId: string) => {
    try {
      // Safety check: prevent deleting currently active profile
      if (profile.activeSession && profile.activeSession.profile.id === profileId) {
        console.error('[ProfileApp] Cannot delete active profile');
        alert('Cannot delete the currently active profile. Please logout first.');
        return;
      }

      await profile.deleteProfile(profileId);
      // Profiles will reload automatically via ProfileContext
    } catch (err) {
      console.error('[ProfileApp] Delete profile failed:', err);
      alert('Failed to delete profile: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // If authenticated, show main app
  if (appState === AppState.Authenticated && profile.activeSession) {
    return <App profileSession={profile.activeSession} />;
  }

  // Show initializing/loading state
  if (profile.loading || appState === AppState.Initializing) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
        <p>Starting TV Mode...</p>
      </div>
    );
  }

  // Show profile flow
  return (
    <>
      {appState === AppState.ProfileSelect && (
        <ProfileSelect
          profiles={profile.profiles}
          lastActiveProfileId={lastActiveProfileId}
          onSelectProfile={handleSelectProfile}
          onCreate={() => setAppState(AppState.CreateProfile)}
          onDelete={handleDeleteProfile}
        />
      )}

      {appState === AppState.PinEntry && selectedProfile && (
        <PinEntry
          profile={selectedProfile}
          onSubmit={handlePinSubmit}
          onCancel={handlePinCancel}
          error={pinError}
        />
      )}

      {appState === AppState.CreateProfile && (
        <CreateProfile
          onSubmit={handleCreateProfile}
          onCancel={() => setAppState(AppState.ProfileSelect)}
          error={createError}
        />
      )}
    </>
  );
};

// Wrap with ProfileProvider
const ProfileAppWithProvider: React.FC = () => {
  return (
    <ProfileProvider>
      <ProfileApp />
    </ProfileProvider>
  );
};

export default ProfileAppWithProvider;
