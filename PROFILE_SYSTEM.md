# Profile System Documentation

## Overview

The JPTV player now includes a **local user profile system** with optional PIN security. Each profile maintains isolated settings, favorites, channel history, and audio normalization data. All data is stored locally in the user's data directory - **no cloud or internet connection required**.

## Architecture

### Storage Structure

```
userData/
└── profiles/
    ├── profiles.json          # Index file with all profile metadata
    └── {profile-uuid}/
        └── data.json          # Profile-specific settings and data
```

### Key Components

1. **Backend (Electron Main Process)**
   - `electron/profile-manager.ts`: Core profile management with bcrypt PIN security
   - `electron/main.ts`: IPC handlers for all profile operations
   - Storage: JSON files in `app.getPath('userData')/profiles/`

2. **Frontend (React/Renderer Process)**
   - `src/ProfileApp.tsx`: Top-level authentication wrapper
   - `src/contexts/ProfileContext.tsx`: Global profile state management
   - `src/components/ProfileSelect.tsx`: Profile selection screen
   - `src/components/PinEntry.tsx`: PIN authentication overlay
   - `src/components/CreateProfile.tsx`: 3-step profile creation wizard

3. **Hooks**
   - `src/hooks/useProfileSettings.ts`: Profile-aware settings hook (replaces useSettings)
   - `src/hooks/useProfileAudioNormalization.ts`: Profile-scoped audio normalization

4. **Types**
   - `src/types/profile.ts`: All profile-related TypeScript interfaces

## Features

### Profile Management

- **Create Profile**: Name (20 chars max), avatar (14 emoji options), optional PIN (4-6 digits)
- **Delete Profile**: With confirmation (cannot delete last profile)
- **Auto-Login**: Remembers last active profile
- **Manual Login**: Select profile → enter PIN (if enabled)

### Security

- **PIN Protection**: Optional 4-6 digit numeric PIN per profile
- **Bcrypt Hashing**: PINs never stored in plaintext (10 salt rounds)
- **No Network**: Fully offline, no cloud authentication
- **Session Management**: In-memory session token, cleared on logout

### Profile Data (Isolated per Profile)

Each profile maintains its own:
- **Favorites**: Channel favorites list
- **Channel History**: Last 50 viewed channels
- **Last Channel**: Auto-restore last watched channel and category
- **Volume**: Personalized volume level (0-100)
- **Audio Normalization**: Per-channel audio profiles with gain settings
  - Enabled/disabled state
  - Target level, max gain, sampling interval, adaptation speed
  - Individual channel audio profiles with learned gain adjustments

## User Interface

### Profile Selection Screen

**Keyboard Navigation:**
- `↑` / `↓`: Navigate between profiles
- `Enter`: Select profile (login if no PIN, show PIN entry if protected)
- `D`: Delete profile (shows confirmation: Y/N)
- `Esc`: Exit app (if at root level)

**Visual Design:**
- Full-screen TV-style grid layout
- Wii-inspired glossy card design with blue accents
- Shows profile avatar, name, PIN badge (🔒), last login timestamp
- "Create Profile" card at end of list
- Auto-selects last active profile

### PIN Entry Overlay

**Keyboard Input:**
- `0-9`: Enter digit
- `Backspace`: Delete last digit
- `Enter`: Submit PIN (also auto-submits when 4+ digits entered)
- `Esc`: Cancel and go back

**Visual Feedback:**
- 6-dot display (○ empty / ● filled blue with glow)
- Shake animation + red banner on incorrect PIN
- Shows profile avatar and name above input

### Create Profile Wizard

**3 Steps:**
1. **Name**: 
   - Keyboard: `A-Z`, `0-9`, `Space`
   - Max 20 characters
   - Live character count
   - `Enter` to proceed

2. **Avatar Selection**:
   - 14 emoji options in 7-column grid
   - Arrow keys to navigate
   - `Enter` to select

3. **PIN Setup**:
   - `Y` / `N`: Enable PIN?
   - If yes: Enter 4-6 digit PIN (auto-submit at 4 digits)
   - Numeric input with 6-dot display
   - `Backspace` to edit

**Progress Indicators:**
- 3 dots at bottom (○ upcoming / ● active blue / ✓ completed green)

## API Reference

### IPC Handlers (Main Process)

```typescript
// List all profiles (without sensitive data)
ipcMain.handle('profile:list', () => profileManager.listProfiles())

// Create new profile
ipcMain.handle('profile:create', (_, request: CreateProfileRequest) => 
  profileManager.createProfile(request))

// Delete profile by ID
ipcMain.handle('profile:delete', (_, profileId: string) => 
  profileManager.deleteProfile(profileId))

// Login to profile (with optional PIN)
ipcMain.handle('profile:login', (_, request: LoginRequest) => 
  profileManager.login(request))

// Logout from active profile
ipcMain.handle('profile:logout', () => profileManager.logout())

// Get active session
ipcMain.handle('profile:getActive', () => profileManager.getActiveSession())

// Get last active profile ID
ipcMain.handle('profile:getLastActive', () => profileManager.getLastActiveProfileId())

// Update active profile data (partial)
ipcMain.handle('profile:updateData', (_, data: Partial<ProfileData>) => 
  profileManager.updateActiveProfileData(data))

// Save active profile (called on app close)
ipcMain.handle('profile:save', () => profileManager.saveActiveProfile())
```

### Renderer API (via window.electron.profile)

```typescript
interface ProfileAPI {
  list(): Promise<Profile[]>;
  create(request: CreateProfileRequest): Promise<Profile>;
  delete(profileId: string): Promise<void>;
  login(request: LoginRequest): Promise<ProfileSession>;
  logout(): Promise<void>;
  getActive(): Promise<ProfileSession | null>;
  getLastActive(): Promise<string | null>;
  updateData(data: Partial<ProfileData>): Promise<void>;
  save(): Promise<void>;
}
```

### React Context

```typescript
// Access profile state and actions
const {
  profiles,           // Profile[] - all profiles
  activeSession,      // ProfileSession | null
  isLoading,          // boolean
  error,              // string | null
  loadProfiles,       // () => Promise<void>
  createProfile,      // (request: CreateProfileRequest) => Promise<Profile>
  deleteProfile,      // (profileId: string) => Promise<void>
  login,              // (request: LoginRequest) => Promise<void>
  logout,             // () => Promise<void>
  updateProfileData,  // (data: Partial<ProfileData>) => Promise<void>
  clearError,         // () => void
} = useProfile();
```

## Data Structures

### Profile

```typescript
interface Profile {
  id: string;                 // UUID v4
  name: string;               // Display name
  avatar?: string;            // Emoji icon
  hasPin: boolean;            // PIN enabled?
  pinHash?: string;           // Bcrypt hash (never sent to renderer)
  createdAt: number;          // Unix timestamp
  lastLogin?: number;         // Unix timestamp
}
```

### ProfileData

```typescript
interface ProfileData {
  favorites: number[];
  channelHistory?: string[];
  lastChannelId?: string;
  lastChannelIndex?: number;
  lastCategory?: string;
  volume?: number;            // 0-100
  audioNormalizationSettings?: {
    enabled: boolean;
    targetLevel: number;      // dB (LUFS)
    maxGainAdjustment: number; // dB
    samplingInterval: number; // ms
    adaptationSpeed: number;  // 0-1
  };
  audioProfiles?: Record<string, {
    channelId: string;
    avgLevel: number;
    sampleCount: number;
    appliedGain: number;
    manualGain?: number;
  }>;
}
```

### ProfileSession

```typescript
interface ProfileSession {
  profile: Profile;
  data: ProfileData;
  loggedInAt: number;
}
```

## Integration with App

### Before (Global Settings)

```typescript
// Old: Global settings.json for entire app
const { settings, updateSetting, toggleFavorite } = useSettings();
const favorites = settings.favorites; // Shared across all users
```

### After (Profile-Scoped Settings)

```typescript
// New: Profile-specific data
function App({ profileSession }: AppProps) {
  const { settings, updateSetting, toggleFavorite } = useProfileSettings(profileSession);
  const favorites = settings.favorites; // Unique per profile
  
  const audioNormalization = useProfileAudioNormalization(
    profileSession, 
    updateProfileData
  );
}
```

### Data Migration

**Settings moved to profile scope:**
- ✅ Favorites (`favorites: number[]`)
- ✅ Channel history (`channelHistory: string[]`)
- ✅ Last channel (`lastChannelId`, `lastChannelIndex`, `lastCategory`)
- ✅ Volume (`volume: number`)
- ✅ Audio normalization settings (`audioNormalizationSettings`)
- ✅ Per-channel audio profiles (`audioProfiles`)

**Global app settings (not profile-scoped):**
- Playlist paths (shared across profiles)
- EPG data (shared)
- Window position/size (shared)
- VLC configuration (shared)

## Persistence

### Auto-Save

- **On app close**: `window-all-closed` event → `profileManager.saveActiveProfile()`
- **On logout**: Saves profile data before clearing session
- **On data update**: `updateProfileData()` immediately writes to disk

### Auto-Restore

- **Last profile**: Loads `lastActiveProfileId` on app start
- **Last channel**: Restores `lastChannelId` and `lastChannelIndex` on profile login
- **Audio profiles**: Loads per-channel gain adjustments from profile data

## Security Considerations

### PIN Security

- **Never plaintext**: PINs hashed with bcrypt (10 salt rounds)
- **Never sent to renderer**: `listProfiles()` omits `pinHash` field
- **Verification in main process**: PIN comparison happens in ProfileManager (main process only)

### No Cloud/Network

- **Fully offline**: No authentication servers, no API calls
- **Local storage only**: All data in `userData/profiles/`
- **No telemetry**: No usage data sent anywhere

### Limitations

- **No PIN recovery**: If user forgets PIN, profile cannot be accessed (by design)
- **No cloud sync**: Profiles tied to single machine
- **No multi-user concurrent access**: One profile active at a time

## Troubleshooting

### Profile Files Missing

If `profiles.json` is corrupted or deleted, ProfileManager will:
1. Create new empty `profiles.json`
2. Scan `profiles/` directory for existing profile folders
3. Attempt to reconstruct index from data files
4. Create default profile if none exist

### Reset All Profiles

**Danger: Deletes all profile data**

```bash
# Close JPTV app first, then:
rm -rf %APPDATA%/jptv-player/profiles/
# or on Windows:
rmdir /s %APPDATA%\jptv-player\profiles
```

On next launch, a default profile will be created.

### View Profile Data (Debug)

```bash
# View profiles index
cat %APPDATA%/jptv-player/profiles/profiles.json

# View specific profile data
cat %APPDATA%/jptv-player/profiles/{uuid}/data.json
```

### Common Issues

**"Cannot delete last profile"**
- Must have at least one profile
- Solution: Create another profile before deleting

**"Invalid PIN" on correct PIN**
- Check keyboard layout (numeric only: 0-9)
- Check Num Lock is enabled

**Profile data not persisting**
- Check `userData/profiles/` directory permissions
- Check disk space
- Check logs: `Console` → `profile:updateData` errors

## Development

### Testing Profile Flow

1. **First Launch**: Auto-creates default profile with no PIN
2. **Create Profile**: Use `C` or select "Create Profile" card
3. **Switch Profiles**: Logout → Select different profile
4. **Test PIN**: Create profile with PIN → Logout → Login with wrong PIN (shake) → Correct PIN (success)
5. **Test Data Isolation**: Create 2 profiles → Add favorites in profile 1 → Switch to profile 2 → Verify favorites empty

### Debug Tools

**ProfileManager logging:**
```typescript
[ProfileManager] Created profile: John (abc-123-def)
[ProfileManager] Login successful: John (abc-123-def)
[ProfileManager] Updated profile data: John
[ProfileManager] Saved profile: John
```

**IPC logging** (in main.ts):
```typescript
ipcMain.handle('profile:create', (_, request) => {
  console.log('[IPC] profile:create', request.name);
  return profileManager.createProfile(request);
});
```

### Extending Profile Data

To add new profile-scoped setting:

1. Update `ProfileData` interface in `src/types/profile.ts`
2. Add default value in `profile-manager.ts` → `loadProfileData()` fallback
3. Access via `profileSession.data.yourNewField` in components
4. Update via `updateProfileData({ yourNewField: value })`

Example:
```typescript
// 1. Add to ProfileData
interface ProfileData {
  // ... existing fields
  customSetting?: boolean;
}

// 2. Add default in ProfileManager
return {
  favorites: [],
  channelHistory: [],
  volume: 50,
  customSetting: false,  // NEW
};

// 3. Use in App.tsx
const customEnabled = profileSession.data.customSetting;
await updateProfileData({ customSetting: true });
```

## Avatar Options

14 emoji avatars available:
- 👤 Default User
- 👨 Man
- 👩 Woman
- 👶 Baby
- 🧑 Person
- 👴 Old Man
- 👵 Old Woman
- 🎮 Gaming
- 🎬 Movies
- 🎵 Music
- 🎨 Art
- 🎯 Sports
- 🎪 Circus
- 🎭 Theater

## Version History

- **v1.0** (Current): Initial profile system implementation
  - Offline-only local profiles
  - bcrypt PIN security (optional)
  - Profile-scoped settings, favorites, audio normalization
  - TV-style UI with keyboard navigation
  - Auto-save/restore
  - Integration with existing IPTV features

## Future Enhancements (Not Implemented)

Potential future features:
- Profile export/import (JSON backup)
- Parental controls (restrict channels per profile)
- Watch history (different from channel history)
- Profile themes/colors
- Profile-specific EPG filters
- Multiple PINs per profile (admin + user)
- Profile groups/families

---

**Note**: This profile system is designed for **single-machine, offline use**. For multi-device sync or cloud features, a completely different architecture (authentication server, API, database) would be required.
