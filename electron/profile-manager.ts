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
import { RotatingLogger } from './logger';

// Constants
const MAX_CHANNEL_HISTORY = 50; // Limit channel history to prevent unbounded growth

export class ProfileManager {
  private userDataPath: string;
  private profilesPath: string;
  private indexPath: string;
  private activeSession: ProfileSession | null = null;
  private logger: RotatingLogger | null = null;

  constructor(userDataPath: string, logger?: RotatingLogger) {
    this.userDataPath = userDataPath;
    this.profilesPath = path.join(userDataPath, 'profiles');
    this.indexPath = path.join(this.profilesPath, 'profiles.json');
    this.logger = logger || null;
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
        this.logger?.info('Created profiles directory', { path: this.profilesPath });
      }

      // Create index if not exists
      if (!fs.existsSync(this.indexPath)) {
        const index: ProfilesIndex = {
          version: PROFILES_INDEX_VERSION,
          profiles: [],
        };
        this.saveIndex(index);
        this.logger?.info('Created profiles index', { path: this.indexPath });
      }

      this.logger?.info('ProfileManager initialized');
    } catch (error) {
      this.logger?.error('ProfileManager initialization failed', { error });
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

    console.log(`[ProfileManager] Created profile: ${profile.name}`);
    this.logger?.info('[ProfileManager] Created profile', { id: profile.id, name: profile.name });
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

    this.logger?.info('Deleted profile', { name: profile.name, id: profileId });
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

    // Update last login and set as last active (single atomic write)
    profile.lastLogin = Date.now();
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

    this.logger?.info('User logged in', { profileName: profile.name, profileId: profile.id });
    return this.activeSession;
  }

  /**
   * Logout current session
   */
  logout(): void {
    if (this.activeSession) {
      // Save current data before logout
      this.saveProfileData(this.activeSession.profile.id, this.activeSession.data);
      this.logger?.info('[ProfileManager] Logged out', { name: this.activeSession.profile.name });
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

    // Enforce channel history limit to prevent unbounded growth
    if (this.activeSession.data.channelHistory && 
        this.activeSession.data.channelHistory.length > MAX_CHANNEL_HISTORY) {
      this.activeSession.data.channelHistory = 
        this.activeSession.data.channelHistory.slice(0, MAX_CHANNEL_HISTORY);
    }

    // Save to disk
    this.saveProfileData(this.activeSession.profile.id, this.activeSession.data);
  }

  /**
   * Save active profile data (on app close or profile switch)
   */
  saveActiveProfile(): void {
    if (this.activeSession) {
      this.saveProfileData(this.activeSession.profile.id, this.activeSession.data);
      this.logger?.info('Saved profile data', { profileName: this.activeSession.profile.name });
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
      this.logger?.info('[ProfileManager] PIN verification', { profileId, result: isValid ? 'success' : 'failed' });
      return isValid;
    } catch (error) {
      this.logger?.error('PIN verification error', { profileId, error });
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
    if (!salt || !hash) return false;
    const verifyHash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha256').toString('hex');
    // Use timing-safe comparison to prevent side-channel attacks
    try {
      const hashBuf = Buffer.from(hash, 'hex');
      const verifyBuf = Buffer.from(verifyHash, 'hex');
      if (hashBuf.length !== verifyBuf.length) return false;
      return crypto.timingSafeEqual(hashBuf, verifyBuf);
    } catch {
      return false;
    }
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
      const index: ProfilesIndex = JSON.parse(content);
      // Validate index version compatibility
      if (index.version && index.version !== PROFILES_INDEX_VERSION) {
        this.logger?.warn('[ProfileManager] Index version mismatch', {
          expected: PROFILES_INDEX_VERSION,
          found: index.version
        });
      }
      return index;
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
      // Atomic write: write to temp file, then rename
      const tempFile = `${this.indexPath}.tmp`;
      const content = JSON.stringify(index, null, 2);
      
      fs.writeFileSync(tempFile, content, 'utf-8');
      fs.renameSync(tempFile, this.indexPath);
    } catch (error) {
      console.error('[ProfileManager] Failed to save index:', error);
      
      // Clean up temp file if it exists
      const tempFile = `${this.indexPath}.tmp`;
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
      
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
      this.logger?.error('Failed to load profile data', { profileId, error });
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
        fs.mkdirSync(dir, { recursive: true});
      }

      // Atomic write: write to temp file, then rename
      const tempFile = `${dataFile}.tmp`;
      const content = JSON.stringify(data, null, 2);
      
      fs.writeFileSync(tempFile, content, 'utf-8');
      
      // Atomic rename (overwrites existing file)
      fs.renameSync(tempFile, dataFile);
    } catch (error) {
      this.logger?.error('Failed to save profile data', { profileId, error });
      
      // Clean up temp file if it exists
      const tempFile = `${dataFile}.tmp`;
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
      
      throw error;
    }
  }
}
