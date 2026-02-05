/**
 * ProfileManager - Local Profile System
 * 
 * Manages user profiles with optional PIN security for offline IPTV app.
 * - Stores profiles in userData/profiles/
 * - Supports PIN authentication with PBKDF2 hashing
 * - Isolated data per profile
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import type {
  Profile,
  ProfileData,
  ProfilesIndex,
  CreateProfileRequest,
  LoginRequest,
  ProfileSession,
} from '../src/types/profile';
import {
  PROFILES_INDEX_VERSION,
  MIN_PIN_LENGTH,
  MAX_PIN_LENGTH,
} from '../src/types/profile';

export class ProfileManager {
  private userDataPath: string;
  private profilesPath: string;
  private indexPath: string;
  private activeSession: ProfileSession | null = null;

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath;
    this.profilesPath = path.join(userDataPath, 'profiles');
    this.indexPath = path.join(this.profilesPath, 'profiles.json');
  }

  /**
   * Initialize profile system
   * Creates profiles directory and index if not exists
   */
  async initialize(): Promise<void> {
    try {
      // Create profiles directory
      if (!fs.existsSync(this.profilesPath)) {
        fs.mkdirSync(this.profilesPath, { recursive: true });
        console.log('[ProfileManager] Created profiles directory');
      }

      // Create index if not exists
      if (!fs.existsSync(this.indexPath)) {
        const index: ProfilesIndex = {
          version: PROFILES_INDEX_VERSION,
          profiles: [],
        };
        this.saveIndex(index);
        console.log('[ProfileManager] Created profiles index');
      }

      console.log('[ProfileManager] Initialized');
    } catch (error) {
      console.error('[ProfileManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a new profile
   */
  async createProfile(request: CreateProfileRequest): Promise<Profile> {
    // Validate name
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Profile name is required');
    }

    // Validate PIN if provided
    if (request.pin !== undefined) {
      this.validatePin(request.pin);
    }

    const index = this.loadIndex();

    // Check for duplicate name
    if (index.profiles.some(p => p.name.toLowerCase() === request.name.toLowerCase())) {
      throw new Error('Profile name already exists');
    }

    // Create profile
    const profile: Profile = {
      id: uuidv4(),
      name: request.name.trim(),
      avatar: request.avatar,
      hasPin: !!request.pin,
      createdAt: Date.now(),
    };

    // Hash PIN if provided
    if (request.pin) {
      profile.pinHash = this.hashPin(request.pin);
    }

    // Add to index
    index.profiles.push(profile);
    this.saveIndex(index);

    // Create profile data directory
    const profileDir = this.getProfileDataPath(profile.id);
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    // Initialize empty profile data
    const initialData: ProfileData = {
      favorites: [],
      channelHistory: [],
      volume: 50,  // Default volume 50%
    };
    this.saveProfileData(profile.id, initialData);

    console.log(`[ProfileManager] Created profile: ${profile.name} (${profile.id})`);
    return profile;
  }

  /**
   * Delete a profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    const index = this.loadIndex();
    const profileIndex = index.profiles.findIndex(p => p.id === profileId);

    if (profileIndex === -1) {
      throw new Error('Profile not found');
    }

    // Don't allow deleting the last profile
    if (index.profiles.length === 1) {
      throw new Error('Cannot delete the last profile');
    }

    // Logout if this is the active profile
    if (this.activeSession?.profile.id === profileId) {
      this.logout();
    }

    // Remove from index
    const profile = index.profiles[profileIndex];
    index.profiles.splice(profileIndex, 1);

    // Clear last active if this was it
    if (index.lastActiveProfileId === profileId) {
      delete index.lastActiveProfileId;
    }

    this.saveIndex(index);

    // Delete profile data directory
    const profileDir = this.getProfileDataPath(profileId);
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }

    console.log(`[ProfileManager] Deleted profile: ${profile.name} (${profileId})`);
  }

  /**
   * List all profiles (without sensitive data)
   */
  listProfiles(): Profile[] {
    const index = this.loadIndex();
    // Return profiles without PIN hash
    return index.profiles.map(p => ({
      ...p,
      pinHash: undefined, // Never send hash to renderer
    }));
  }

  /**
   * Login to a profile
   */
  async login(request: LoginRequest): Promise<ProfileSession> {
    const index = this.loadIndex();
    const profile = index.profiles.find(p => p.id === request.profileId);

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Verify PIN if required
    if (profile.hasPin) {
      if (!request.pin) {
        throw new Error('PIN required');
      }

      if (!profile.pinHash) {
        throw new Error('Profile PIN hash missing');
      }

      const pinValid = this.comparePin(request.pin, profile.pinHash);
      if (!pinValid) {
        console.warn(`[ProfileManager] Invalid PIN attempt for profile: ${profile.name}`);
        throw new Error('Invalid PIN');
      }
    }

    // Update last login
    profile.lastLogin = Date.now();
    this.saveIndex(index);

    // Set as last active
    index.lastActiveProfileId = profile.id;
    this.saveIndex(index);

    // Load profile data
    const data = this.loadProfileData(profile.id);

    // Create session
    this.activeSession = {
      profile: { ...profile, pinHash: undefined }, // Don't keep hash in memory
      data,
      loggedInAt: Date.now(),
    };

    console.log(`[ProfileManager] Logged in: ${profile.name} (${profile.id})`);
    return this.activeSession;
  }

  /**
   * Logout current session
   */
  logout(): void {
    if (this.activeSession) {
      // Save current data before logout
      this.saveProfileData(this.activeSession.profile.id, this.activeSession.data);
      console.log(`[ProfileManager] Logged out: ${this.activeSession.profile.name}`);
      this.activeSession = null;
    }
  }

  /**
   * Get active profile session
   */
  getActiveSession(): ProfileSession | null {
    return this.activeSession;
  }

  /**
   * Get last active profile ID (for auto-login)
   */
  getLastActiveProfileId(): string | null {
    const index = this.loadIndex();
    return index.lastActiveProfileId || null;
  }

  /**
   * Update active profile data
   */
  updateActiveProfileData(data: Partial<ProfileData>): void {
    if (!this.activeSession) {
      throw new Error('No active session');
    }

    this.activeSession.data = {
      ...this.activeSession.data,
      ...data,
    };

    // Save to disk
    this.saveProfileData(this.activeSession.profile.id, this.activeSession.data);
  }

  /**
   * Save active profile data (on app close or profile switch)
   */
  saveActiveProfile(): void {
    if (this.activeSession) {
      this.saveProfileData(this.activeSession.profile.id, this.activeSession.data);
      console.log(`[ProfileManager] Saved profile data: ${this.activeSession.profile.name}`);
    }
  }

  /**
   * Verify PIN for parental lock (without creating session)
   */
  async verifyPin(profileId: string, pin: string): Promise<boolean> {
    const index = this.loadIndex();
    const profile = index.profiles.find(p => p.id === profileId);

    if (!profile) {
      throw new Error('Profile not found');
    }

    if (!profile.hasPin || !profile.pinHash) {
      // Profile has no PIN, verification not applicable
      return false;
    }

    try {
      const isValid = this.comparePin(pin, profile.pinHash);
      console.log(`[ProfileManager] PIN verification for ${profile.name}: ${isValid ? 'success' : 'failed'}`);
      return isValid;
    } catch (error) {
      console.error('[ProfileManager] PIN verification error:', error);
      return false;
    }
  }

  // ========== Private Methods ==========

  private hashPin(pin: string): string {
    // Use PBKDF2 with SHA-256 for secure PIN hashing
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha256').toString('hex');
    return `${salt}:${hash}`;
  }

  private comparePin(pin: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha256').toString('hex');
    return hash === verifyHash;
  }

  private validatePin(pin: string): void {
    // Must be numeric
    if (!/^\d+$/.test(pin)) {
      throw new Error('PIN must contain only digits');
    }

    // Check length
    if (pin.length < MIN_PIN_LENGTH || pin.length > MAX_PIN_LENGTH) {
      throw new Error(`PIN must be ${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} digits`);
    }
  }

  private getProfileDataPath(profileId: string): string {
    return path.join(this.profilesPath, profileId);
  }

  private getProfileDataFile(profileId: string): string {
    return path.join(this.getProfileDataPath(profileId), 'data.json');
  }

  private loadIndex(): ProfilesIndex {
    try {
      const content = fs.readFileSync(this.indexPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('[ProfileManager] Failed to load index:', error);
      // Return empty index on error
      return {
        version: PROFILES_INDEX_VERSION,
        profiles: [],
      };
    }
  }

  private saveIndex(index: ProfilesIndex): void {
    try {
      fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
      console.error('[ProfileManager] Failed to save index:', error);
      throw error;
    }
  }

  private loadProfileData(profileId: string): ProfileData {
    const dataFile = this.getProfileDataFile(profileId);

    try {
      if (fs.existsSync(dataFile)) {
        const content = fs.readFileSync(dataFile, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error(`[ProfileManager] Failed to load data for profile ${profileId}:`, error);
    }

    // Return default data
    return {
      favorites: [],
      channelHistory: [],
      volume: 50,
    };
  }

  private saveProfileData(profileId: string, data: ProfileData): void {
    const dataFile = this.getProfileDataFile(profileId);

    try {
      // Ensure directory exists
      const dir = this.getProfileDataPath(profileId);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`[ProfileManager] Failed to save data for profile ${profileId}:`, error);
      throw error;
    }
  }
}
