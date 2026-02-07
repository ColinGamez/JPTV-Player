/**
 * ProfileContext - React Context for Profile System
 * 
 * Provides profile state and actions throughout the app.
 * Handles profile selection, login, logout, and data persistence.
 * Includes lifecycle hooks for safe profile switching.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import type { Profile, ProfileSession, CreateProfileRequest, LoginRequest } from '../types/profile';

type ProfileChangeCallback = (newSession: ProfileSession | null, oldSession: ProfileSession | null) => void | Promise<void>;

interface ProfileContextValue {
  // State
  profiles: Profile[];
  activeSession: ProfileSession | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadProfiles: () => Promise<void>;
  createProfile: (request: CreateProfileRequest) => Promise<Profile>;
  deleteProfile: (profileId: string) => Promise<void>;
  login: (request: LoginRequest) => Promise<ProfileSession>;
  logout: () => Promise<void>;
  switchProfile: (request: LoginRequest) => Promise<ProfileSession>;
  updateProfileData: (data: Partial<ProfileSession['data']>) => Promise<void>;
  clearError: () => void;
  
  // Lifecycle
  onProfileChange: (callback: ProfileChangeCallback) => () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeSession, setActiveSession] = useState<ProfileSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store profile change callbacks
  const profileChangeCallbacks = useRef<Set<ProfileChangeCallback>>(new Set());
  const previousSession = useRef<ProfileSession | null>(null);

  // Register profile change listener
  const onProfileChange = useCallback((callback: ProfileChangeCallback) => {
    profileChangeCallbacks.current.add(callback);
    
    // Return unsubscribe function
    return () => {
      profileChangeCallbacks.current.delete(callback);
    };
  }, []);

  // Notify listeners when profile changes
  const notifyProfileChange = useCallback(async (newSession: ProfileSession | null, oldSession: ProfileSession | null) => {
    console.log('[ProfileContext] Profile change:', {
      old: oldSession?.profile.name,
      new: newSession?.profile.name,
    });

    for (const callback of profileChangeCallbacks.current) {
      try {
        await callback(newSession, oldSession);
      } catch (err) {
        console.error('[ProfileContext] Profile change callback error:', err);
      }
    }
  }, []);

  // Track profile changes and notify listeners
  useEffect(() => {
    const oldSession = previousSession.current;
    const newSession = activeSession;

    if (oldSession?.profile.id !== newSession?.profile.id) {
      notifyProfileChange(newSession, oldSession);
      previousSession.current = newSession;
    }
  }, [activeSession, notifyProfileChange]);

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
  }, []);

  // Save profile data on unmount or when active session changes
  useEffect(() => {
    return () => {
      if (activeSession) {
        window.electron.profile.save().catch(err => {
          console.error('[ProfileContext] Failed to save profile on unmount:', err);
        });
      }
    };
  }, [activeSession]);

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const profileList = await window.electron.profile.list();
      setProfiles(profileList);

      // Check for active session
      const session = await window.electron.profile.getActive();
      setActiveSession(session);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profiles';
      console.error('[ProfileContext] Load profiles failed:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProfile = useCallback(async (request: CreateProfileRequest): Promise<Profile> => {
    setIsLoading(true);
    setError(null);

    try {
      const profile = await window.electron.profile.create(request);
      await loadProfiles(); // Reload profile list
      return profile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create profile';
      console.error('[ProfileContext] Create profile failed:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadProfiles]);

  const deleteProfile = useCallback(async (profileId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await window.electron.profile.delete(profileId);
      await loadProfiles(); // Reload profile list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete profile';
      console.error('[ProfileContext] Delete profile failed:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadProfiles]);

  const login = useCallback(async (request: LoginRequest): Promise<ProfileSession> => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await window.electron.profile.login(request);
      setActiveSession(session);
      await loadProfiles(); // Reload to update last login time
      return session;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      console.error('[ProfileContext] Login failed:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadProfiles]);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const oldSession = activeSession;
      
      // Save profile data before logout
      if (oldSession) {
        console.log('[ProfileContext] Saving profile before logout...');
        await window.electron.profile.save();
      }
      
      // Notify listeners BEFORE clearing session (for cleanup)
      await notifyProfileChange(null, oldSession);
      
      // Perform logout
      await window.electron.profile.logout();
      setActiveSession(null);
      previousSession.current = null;
      
      console.log('[ProfileContext] Logout complete');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed';
      console.error('[ProfileContext] Logout failed:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [activeSession, notifyProfileChange]);

  const switchProfile = useCallback(async (request: LoginRequest): Promise<ProfileSession> => {
    setIsLoading(true);
    setError(null);

    try {
      const oldSession = activeSession;
      
      // Save current profile before switching
      if (oldSession) {
        console.log('[ProfileContext] Saving current profile before switch...');
        await window.electron.profile.save();
      }
      
      // Notify listeners about upcoming switch (for cleanup)
      console.log('[ProfileContext] Notifying profile switch...');
      await notifyProfileChange(null, oldSession);
      
      // Perform backend logout
      await window.electron.profile.logout();
      
      // Login to new profile
      console.log('[ProfileContext] Switching to new profile...');
      const session = await window.electron.profile.login(request);
      
      // Update state
      setActiveSession(session);
      previousSession.current = session;
      
      // Reload profile list to update timestamps
      await loadProfiles();
      
      console.log('[ProfileContext] Profile switch complete:', session.profile.name);
      return session;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Profile switch failed';
      console.error('[ProfileContext] Profile switch failed:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [activeSession, notifyProfileChange, loadProfiles]);

  const updateProfileData = useCallback(async (data: Partial<ProfileSession['data']>): Promise<void> => {
    if (!activeSession) {
      throw new Error('No active session');
    }

    try {
      await window.electron.profile.updateData(data);
      
      // Update local state
      setActiveSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          data: {
            ...prev.data,
            ...data,
          },
        };
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile data';
      console.error('[ProfileContext] Update profile data failed:', err);
      setError(errorMessage);
      throw err;
    }
  }, [activeSession]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<ProfileContextValue>(() => ({
    profiles,
    activeSession,
    isLoading,
    error,
    loadProfiles,
    createProfile,
    deleteProfile,
    login,
    logout,
    switchProfile,
    updateProfileData,
    clearError,
    onProfileChange,
  }), [profiles, activeSession, isLoading, error,
       loadProfiles, createProfile, deleteProfile, login,
       logout, switchProfile, updateProfileData, clearError, onProfileChange]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

/**
 * Hook to access profile context
 */
export const useProfile = (): ProfileContextValue => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
};
