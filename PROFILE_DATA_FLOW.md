# Profile System Data Flow

## Overview

This document describes how profile data flows through the application subsystems and how profile switching is handled safely.

## Architecture

```
ProfileApp (Authentication)
    ↓
ProfileContext (State Management)
    ↓
App (Main Application)
    ↓
Subsystems (Favorites, Audio, History, etc.)
```

## Profile Lifecycle

### 1. Initial Login

```
User selects profile
    ↓
ProfileApp → profile.login(profileId, pin?)
    ↓
ProfileManager verifies PIN (main process)
    ↓
Creates ProfileSession with profile + data
    ↓
ProfileContext.activeSession = session
    ↓
ProfileContext notifies listeners (onProfileChange)
    ↓
App component receives profileSession prop
    ↓
Subsystems initialize with profile data:
    - useProfileSettings(profileSession)
    - useProfileAudioNormalization(profileSession, updateProfileData)
    ↓
Last channel auto-restore (if exists)
```

### 2. Runtime Operation

```
User interacts with app
    ↓
State changes (favorites, channel, audio profiles)
    ↓
updateProfileData({ field: value })
    ↓
ProfileContext updates local state
    ↓
IPC → profile:updateData
    ↓
ProfileManager writes to disk immediately
    ↓
userData/profiles/{uuid}/data.json updated
```

### 3. Profile Switch

```
User triggers profile switch
    ↓
ProfileContext.switchProfile(newProfileId, pin?)
    ↓
PHASE 1: Cleanup
    - Notify onProfileChange listeners (oldSession, null)
    - App stops playback (playerAdapter.stop())
    - Audio monitoring stopped
    - Last channel saved
    - Runtime state cleared
    ↓
PHASE 2: Backend Switch
    - Save current profile (profile:save)
    - Logout from old profile (profile:logout)
    - Login to new profile (profile:login)
    ↓
PHASE 3: Initialization
    - ProfileContext.activeSession = newSession
    - Notify onProfileChange listeners (null, newSession)
    - App receives new profileSession prop
    - Subsystems reload with new profile data
    - Last channel auto-restore (if exists)
```

### 4. Logout

```
User logs out
    ↓
ProfileContext.logout()
    ↓
PHASE 1: Cleanup
    - Notify onProfileChange listeners (oldSession, null)
    - App stops playback
    - Audio monitoring stopped
    - Last channel saved
    - Runtime state cleared
    ↓
PHASE 2: Backend Logout
    - Save profile data (profile:save)
    - Backend logout (profile:logout)
    - Clear active session
    ↓
PHASE 3: Return to Login
    - ProfileContext.activeSession = null
    - App unmounts
    - ProfileApp shows ProfileSelect screen
```

### 5. App Close

```
Window close event
    ↓
App beforeunload handler:
    - Save last channel
    - Save profile data
    ↓
ProfileContext cleanup:
    - profile:save (on unmount)
    ↓
Main process window-all-closed:
    - profileManager.saveActiveProfile()
    - App quits
```

## Data Isolation by Subsystem

### Favorites

**Storage**: `profileSession.data.favorites: number[]`

**Read**: 
```typescript
const { settings } = useProfileSettings(profileSession);
const isFavorite = settings.favorites.includes(channelId);
```

**Write**:
```typescript
const { toggleFavorite } = useProfileSettings(profileSession);
await toggleFavorite(channelId);
// → Calls updateProfileData({ favorites: [...] })
// → IPC: profile:updateData
// → Disk: userData/profiles/{uuid}/data.json
```

**On Profile Switch**:
1. Old favorites cleared from UI state
2. New profile favorites loaded from `newSession.data.favorites`
3. No favorites leak between profiles

### Channel History

**Storage**: `profileSession.data.channelHistory: string[]`

**Read**:
```typescript
const { settings } = useProfileSettings(profileSession);
const history = settings.channelHistory || [];
```

**Write**:
```typescript
const { addToHistory } = useChannelHistory(settings, updateSetting);
await addToHistory(channelId);
// → Calls updateSetting('channelHistory', [...])
// → Calls updateProfileData({ channelHistory: [...] })
// → IPC: profile:updateData
```

**On Profile Switch**:
1. History cleared from UI state
2. New profile history loaded
3. Max 50 channels per profile

### Last Channel Resume

**Storage**: 
- `profileSession.data.lastChannelId: string`
- `profileSession.data.lastChannelIndex: number`
- `profileSession.data.lastCategory: string`

**Write (on channel change)**:
```typescript
await saveLastChannel(channel, channelIndex, updateSetting);
await updateSetting('lastCategory', selectedCategory);
```

**Read (on login)**:
```typescript
useEffect(() => {
  if (!hasRestoredChannel.current && settings.lastChannelId) {
    const result = findChannelById(channels, settings.lastChannelId);
    if (result) {
      setSelectedChannel(result.channel);
      setChannelIndex(result.index);
      setSelectedCategory(settings.lastCategory);
      // Auto-play
      playChannelWithFallback(result.channel);
    }
    hasRestoredChannel.current = true;
  }
}, [channels, settings.lastChannelId]);
```

**On Profile Switch**:
1. Current channel saved to old profile
2. Playback stopped
3. State cleared
4. New profile's last channel restored (if exists)

### Audio Normalization

**Storage**: 
- `profileSession.data.audioNormalizationSettings` - Global enable/target/max
- `profileSession.data.audioProfiles` - Per-channel learned gains

**Format**:
```typescript
{
  audioNormalizationSettings: {
    enabled: boolean,
    targetLevel: number,      // dB (LUFS)
    maxGainAdjustment: number, // dB
    samplingInterval: number,  // ms
    adaptationSpeed: number    // 0-1
  },
  audioProfiles: {
    "channel-123": {
      channelId: "channel-123",
      avgLevel: -18.5,
      sampleCount: 450,
      appliedGain: 4.5,
      manualGain?: -2.0
    }
  }
}
```

**Read**:
```typescript
const audioNormalization = useProfileAudioNormalization(
  profileSession, 
  updateProfileData
);
```

**Write** (automatic during monitoring):
```typescript
// Every samplingInterval (default 1000ms)
audioNormalization monitors current channel
    ↓
Samples audio level from VLC
    ↓
Updates profile with exponential moving average
    ↓
Debounced save (1 second) → updateProfileData({ audioProfiles: {...} })
```

**Write** (manual override):
```typescript
audioNormalization.setUserGainOverride(channelId, gainDb);
// → Immediate save to profile
```

**On Profile Switch**:
1. Stop monitoring old profile's channel
2. Save accumulated audio data to old profile
3. Clear in-memory audio profiles
4. Load new profile's audio profiles
5. Apply gain if resuming to a channel

### Volume

**Storage**: `profileSession.data.volume: number` (0-100)

**Read/Write**:
```typescript
const { settings, updateSetting } = useProfileSettings(profileSession);

// Read
const currentVolume = settings.volume || 50;

// Write
await updateSetting('volume', newVolume);
```

**On Profile Switch**:
1. Old profile's volume saved
2. New profile's volume loaded
3. VLC volume updated (if playing)

## Persistence Strategy

### Auto-Save Triggers

1. **Periodic** (every 30 seconds):
   ```typescript
   setInterval(() => {
     window.electron.profile.save();
   }, 30000);
   ```

2. **On State Change** (immediate):
   ```typescript
   updateProfileData({ favorites: [...] })
   // → IPC: profile:updateData (writes to disk)
   ```

3. **On Profile Switch**:
   ```typescript
   switchProfile()
   // → Saves old profile before switching
   // → Loads new profile after switch
   ```

4. **On App Close**:
   ```typescript
   // Renderer beforeunload:
   window.addEventListener('beforeunload', () => {
     saveLastChannel();
     window.electron.profile.save();
   });

   // Main process window-all-closed:
   app.on('window-all-closed', () => {
     profileManager.saveActiveProfile();
   });
   ```

5. **Audio Normalization** (debounced 1 second):
   ```typescript
   // After each audio sample processed
   setTimeout(() => {
     updateProfileData({ audioProfiles: {...} });
   }, 1000);
   ```

### Save Flow

```
Component calls updateProfileData({ field: value })
    ↓
ProfileContext updates local state (immediate UI update)
    ↓
IPC: profile:updateData
    ↓
Main Process: ProfileManager.updateActiveProfileData()
    ↓
Merge partial update with existing data
    ↓
Write JSON to disk: userData/profiles/{uuid}/data.json
    ↓
Return success to renderer
```

## Error Handling

### Profile Switch Errors

```typescript
try {
  await profile.switchProfile({ profileId, pin });
} catch (err) {
  // Switch failed - old profile remains active
  console.error('Profile switch failed:', err);
  // User stays on old profile
  // No data loss (old profile saved before attempt)
}
```

### Save Errors

```typescript
try {
  await updateProfileData({ favorites: [...] });
} catch (err) {
  // Local state updated, disk save failed
  console.error('Failed to save:', err);
  // State will be saved on next auto-save or app close
  // User sees change immediately (optimistic update)
}
```

### Playback Errors During Switch

```typescript
// Always stop playback BEFORE switching
try {
  await playerAdapter.stop();
} catch (err) {
  console.error('Failed to stop playback:', err);
  // Continue with switch anyway
}
```

## State Clearing on Profile Change

When profile changes (switch/logout), App component clears:

```typescript
// Playback
playerAdapter.stop();
audioNormalization.stopMonitoring();

// UI State
setSelectedChannel(null);
setChannelIndex(0);
setCategoryIndex(0);
setSelectedCategory('すべて');
setShowInfo(false);
setShowNowNext(false);
setShowFullGuide(false);

// Flags
hasRestoredChannel.current = false;
```

This ensures:
- No channel continues playing after switch
- No audio monitoring leaks
- No UI artifacts from old profile
- Clean slate for new profile

## Profile Data Schema

### Complete ProfileData Interface

```typescript
interface ProfileData {
  // Favorites
  favorites: number[];
  
  // Channel History
  channelHistory?: string[];      // Max 50, most recent first
  
  // Resume State
  lastChannelId?: string;
  lastChannelIndex?: number;
  lastCategory?: string;
  
  // Volume
  volume?: number;                // 0-100, default 50
  
  // Audio Normalization
  audioNormalizationSettings?: {
    enabled: boolean;
    targetLevel: number;          // dB (LUFS), default -23
    maxGainAdjustment: number;    // dB, default 12
    samplingInterval: number;     // ms, default 1000
    adaptationSpeed: number;      // 0-1, default 0.1
  };
  
  // Per-Channel Audio Profiles
  audioProfiles?: Record<string, {
    channelId: string;
    avgLevel: number;             // Learned average dB
    sampleCount: number;          // Number of samples collected
    appliedGain: number;          // Currently applied gain dB
    manualGain?: number;          // User override gain dB
  }>;
}
```

### Default Values (on profile creation)

```typescript
{
  favorites: [],
  channelHistory: [],
  volume: 50,
  // audioNormalizationSettings: undefined (uses app default)
  // audioProfiles: undefined (empty until channels played)
}
```

## Race Condition Prevention

### Problem: Rapid Profile Switches

```
User switches profile A → B → C rapidly
Each switch triggers:
1. Save profile
2. Logout
3. Login
```

### Solution: Locking in ProfileContext

```typescript
const [isLoading, setIsLoading] = useState(false);

const switchProfile = async (request) => {
  if (isLoading) {
    throw new Error('Profile switch already in progress');
  }
  
  setIsLoading(true);
  try {
    // ... switch logic
  } finally {
    setIsLoading(false);
  }
};
```

### Problem: Concurrent Saves

```
Auto-save timer fires
User changes favorite
App closes
All trigger save simultaneously
```

### Solution: Backend Serialization

ProfileManager uses synchronous file writes (fs.writeFileSync):
- Writes are atomic
- No race conditions on disk
- Last write wins (acceptable for profile data)

## Testing Profile Isolation

### Test Case 1: Favorites Isolation

```
1. Login to Profile A
2. Add channel 5 to favorites
3. Verify favorites = [5]
4. Switch to Profile B
5. Verify favorites = []
6. Add channel 10 to favorites
7. Verify favorites = [10]
8. Switch back to Profile A
9. Verify favorites = [5] (not [5, 10])
```

### Test Case 2: Audio Profile Isolation

```
1. Login to Profile A
2. Play channel 1, let audio normalize
3. Check profile A audioProfiles has channel 1 data
4. Switch to Profile B
5. Check profile B audioProfiles is empty
6. Play channel 1, let audio normalize
7. Check profile B audioProfiles has channel 1 data (different from A)
8. Switch back to Profile A
9. Verify profile A channel 1 audio data unchanged
```

### Test Case 3: Resume State Isolation

```
1. Login to Profile A
2. Play channel 5, category "News"
3. Logout
4. Login to Profile B
5. Play channel 10, category "Sports"
6. Logout
7. Login to Profile A
8. Verify auto-resumed to channel 5, category "News"
9. Logout
10. Login to Profile B
11. Verify auto-resumed to channel 10, category "Sports"
```

## Debugging

### Enable Profile Debug Logs

```typescript
// In ProfileContext
console.log('[ProfileContext] Profile change:', { old, new });

// In App
console.log('[App] Profile change detected');
console.log('[App] Stopping playback');
console.log('[App] Saving last channel');
console.log('[App] Profile change cleanup complete');

// In ProfileManager (main process)
console.log('[ProfileManager] Saving profile:', profileName);
console.log('[ProfileManager] Profile saved successfully');
```

### Check Profile Data on Disk

```bash
# View current profile data
cat %APPDATA%/jptv-player/profiles/{uuid}/data.json

# Pretty print
cat %APPDATA%/jptv-player/profiles/{uuid}/data.json | jq .
```

### Verify No Data Leaks

```typescript
// Before switch
const oldFavorites = profileSession.data.favorites;

// After switch
const newFavorites = profileSession.data.favorites;

// Should be different arrays
console.assert(oldFavorites !== newFavorites);
```

## Performance Considerations

### Minimize Disk I/O

- **updateProfileData**: Writes immediately (necessary for data integrity)
- **Audio profiles**: Debounced 1 second (reduces writes from 1000/s to 1/s)
- **Auto-save**: Every 30 seconds (not too frequent)

### Memory Usage

- **activeSession**: One ProfileSession in memory (~10 KB)
- **audioProfiles**: One Map per profile (~1 KB per 100 channels)
- **Cleanup on switch**: Old session GC'd, new session loaded

### Startup Time

- **Profile list**: Load all profiles on app start (~1ms for 10 profiles)
- **Profile data**: Loaded only for active profile (~5ms)
- **Audio profiles**: Lazy-loaded as channels played

## Future Enhancements

1. **Profile Groups**: Family/parent-child relationships
2. **Selective Sync**: Export/import specific subsystem data
3. **Profile Templates**: Preset configurations for new profiles
4. **Data Migration**: Upgrade old profile data format
5. **Conflict Resolution**: Handle concurrent edits (if multi-device in future)
