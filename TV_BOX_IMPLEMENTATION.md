# TV Set-Top Box Mode - Implementation Summary

## ✅ Completed Implementation

The IPTV app has been successfully transformed from a desktop application into a TV set-top box experience.

## Files Modified

### 1. **Profile Types** - `src/types/profile.ts`
**Added TV Box Fields:**
```typescript
isFullscreen?: boolean;       // Default: true
audioOnlyMode?: boolean;      // Audio-only state
autoLoginEnabled?: boolean;   // Auto-login flag (default: true)
```

### 2. **Electron Main Process** - `electron/main.ts`
**Window Configuration:**
- `frame: false` → Borderless window
- `fullscreen: !isDev` → Start fullscreen in production
- `show: false` → Prevent flash during load

**IPC Handlers Added:**
- `window:toggleFullscreen` → Toggle fullscreen state
- `window:setFullscreen` → Set fullscreen explicitly
- `window:isFullscreen` → Query fullscreen state

**Ready-to-Show Handler:**
- Shows window only after content loaded (prevents flash)

### 3. **Preload Bridge** - `electron/preload.ts`
**Exposed Window APIs:**
```typescript
window.electron.window = {
  toggleFullscreen: () => Promise<boolean>,
  setFullscreen: (fullscreen: boolean) => Promise<void>,
  isFullscreen: () => Promise<boolean>
}
```

### 4. **TypeScript Definitions** - `src/types/electron.d.ts`
**Added Window API Types:**
```typescript
window: {
  toggleFullscreen: () => Promise<boolean>;
  setFullscreen: (fullscreen: boolean) => Promise<void>;
  isFullscreen: () => Promise<boolean>;
}
```

### 5. **Auto-Login System** - `src/ProfileApp.tsx`
**Changes:**
- Added `Initializing` state to `AppState` enum
- Added `autoLoginAttempted` flag to prevent loops
- Added auto-login effect that:
  - Loads last active profile ID
  - Checks if profile has no PIN
  - Auto-logs in if criteria met
  - Falls back to ProfileSelect if auto-login fails
- Updated loading screen text: "Starting TV Mode..."

**Flow:**
```
Initializing → Auto-login attempt → Authenticated (success)
                                  → ProfileSelect (failure)
```

### 6. **TV Mode Hooks** - Created Two New Hooks

#### `src/hooks/useUIAutoHide.ts` (~100 lines)
**Purpose:** TV-style UI visibility management

**Features:**
- Keyboard input shows/resets UI
- Mouse movement ignored (TV behavior)
- Configurable auto-hide delay (default 5000ms)
- Returns: `{ isUIVisible, showUI, hideUI, resetTimer }`

**Implementation:**
- Uses `useState` for visibility
- Uses `useRef` for timer management
- Keyboard event listener on `keydown`
- No mouse event listeners (intentional)

#### `src/hooks/useFullscreen.ts` (~75 lines)
**Purpose:** Fullscreen management with profile persistence

**Features:**
- Syncs fullscreen on mount
- Syncs fullscreen on profile change
- F11 key handling
- Persists state to profile data
- Returns: `{ isFullscreen, toggleFullscreen, setFullscreen }`

**Implementation:**
- Reads `profileSession.data.isFullscreen` (default: true)
- Calls `window.electron.window` APIs
- Saves to profile via `updateProfileData`

### 7. **Main App** - `src/App.tsx`
**Major Changes:**

**Imports:**
- Added `useUIAutoHide` and `useFullscreen` hooks

**State Management:**
- Integrated `useUIAutoHide(5000)` → 5-second auto-hide
- Integrated `useFullscreen(profileSession, updateProfileData)`

**Auto-Play on Launch:**
- Modified channel restoration effect
- Changed from "select only" to "play immediately"
- Logs: `[TV Mode] Auto-playing last channel: {name}`
- Auto-plays with fallback support
- Switches audio normalization automatically

**Keyboard Handling:**
- Added `showUI()` and `resetTimer()` on every keypress
- Added F11 handler for fullscreen toggle
- Enhanced ESC handler:
  - Closes donation jar if open
  - Closes parental lock settings if open
  - Closes full guide if open
  - Closes now/next overlay if open
  - Closes info overlay if open
  - Returns to playback (always)
- Added overlay state to dependencies

**Clean Shutdown:**
- Enhanced `beforeunload` handler
- Stops VLC playback cleanly
- Saves last channel
- Saves fullscreen state
- Saves audio-only mode
- Saves profile data
- Logs: `[TV Mode] Clean shutdown complete`

**UI Auto-Hide:**
- Wrapped `CategoryRail` and `ChannelList` in `{isUIVisible && <> ... </>}`
- Player always visible (never hides)
- Overlays remain modal (appear on top)

## New Files Created

1. **`src/hooks/useUIAutoHide.ts`** - UI auto-hide logic
2. **`src/hooks/useFullscreen.ts`** - Fullscreen management
3. **`TV_BOX_MODE.md`** - Comprehensive documentation

## Behavior Changes

### Before (Desktop App)
- Manual profile selection required
- Channels selected but not auto-played
- Windowed with title bar
- Mouse and keyboard both wake UI
- ESC only returns to channel list

### After (TV Box Mode)
- Auto-login to last profile (no PIN)
- Auto-play last channel immediately
- Fullscreen borderless (production)
- Only keyboard wakes UI (mouse ignored)
- ESC closes overlays and returns to playback
- UI auto-hides after 5 seconds
- F11 toggles fullscreen
- Clean shutdown with state save

## Testing Checklist

- [ ] Auto-login works on app restart
- [ ] Auto-play resumes last channel
- [ ] UI auto-hides after 5 seconds
- [ ] Keyboard input wakes UI
- [ ] Mouse movement does NOT wake UI
- [ ] F11 toggles fullscreen
- [ ] Fullscreen state persists per profile
- [ ] ESC closes all overlays
- [ ] ESC returns to playback
- [ ] Clean shutdown saves state
- [ ] Last channel restored on restart

## Configuration

All settings stored per-profile in:
```
{userData}/profiles/{profileId}/data.json
```

### Relevant Profile Fields:
```json
{
  "lastChannelId": "0x1a2b3c4d",
  "lastChannelIndex": 42,
  "isFullscreen": true,
  "audioOnlyMode": false,
  "autoLoginEnabled": true
}
```

## Development vs Production

### Development Mode (`npm run dev`)
- Window has frame/title bar
- Starts in windowed mode
- Not fullscreen by default
- Debug panels visible

### Production Mode (`npm run build`)
- Borderless window
- Starts fullscreen automatically
- Auto-login enabled
- UI auto-hide active
- Clean TV box experience

## Known Limitations

1. **PIN-Protected Profiles:** Auto-login skipped, falls back to profile select
2. **First Launch:** No auto-login possible (no last profile ID)
3. **Mouse Input:** Completely ignored for UI wake (intentional TV behavior)
4. **Dev Mode:** Fullscreen auto-start disabled for easier debugging

## Future Enhancements

Potential improvements:
- Remote control IR input support
- HDMI-CEC integration
- Sleep timer functionality
- Channel preview (PIP mode)
- Voice control wake word
- Network status overlay
- Recording scheduler

## Documentation

See **`TV_BOX_MODE.md`** for:
- Detailed behavior descriptions
- Keyboard reference guide
- Architecture diagrams
- User experience flows
- Troubleshooting guide
- Technical implementation notes

## Quick Start

1. **First Launch:**
   - Create a profile (no PIN for auto-login)
   - Load a playlist (`O` key)
   - Select a channel
   - Close app

2. **Subsequent Launches:**
   - App auto-logs in
   - App auto-plays last channel
   - App enters fullscreen
   - UI auto-hides after 5s
   - Press any key to show UI
   - Press ESC to hide UI

3. **Fullscreen Toggle:**
   - Press `F11` to toggle
   - State persists per profile

4. **Return to Playback:**
   - Press `ESC` from any overlay
   - UI hides, playback continues

## Summary

The app now behaves like a living room TV set-top box:
- ✅ Auto-login without interaction
- ✅ Auto-play last channel
- ✅ Fullscreen borderless window
- ✅ Keyboard-only UI wake
- ✅ 5-second UI auto-hide
- ✅ Playback-centric UX
- ✅ ESC returns to playback
- ✅ F11 fullscreen toggle
- ✅ Clean state persistence
- ✅ Proper shutdown handling

**The transformation is complete! 🎉📺**
