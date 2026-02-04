# 📺 TV Set-Top Box Mode

## Overview

The IPTV app now behaves like a **TV set-top box** rather than a traditional desktop application. This transformation delivers a streamlined, appliance-like experience designed for living room use with remote controls or keyboards.

## Key Behaviors

### 1. **Startup Experience**
- **Auto-Login**: Automatically logs into the last active profile without requiring interaction
  - Works for profiles without PINs
  - PIN-protected profiles fallback to profile selection
- **Auto-Play**: Immediately starts playing the last watched channel
- **Fullscreen**: Launches in borderless fullscreen mode (production builds)
- **No Splash Screen**: Direct to playback with minimal UI flash

### 2. **Playback-Centric UI**
- **Playback as Home**: Live TV playback is always the "home screen"
- **Overlay Design**: All UI elements (channel list, EPG, settings) appear as overlays on top of playback
- **Continuous Playback**: Video never stops when navigating menus
- **ESC Returns Home**: Pressing ESC always hides overlays and returns to playback

### 3. **TV-Style UI Auto-Hide**
- **Keyboard-Only Wake**: UI appears only when keyboard/remote buttons are pressed
- **Mouse Ignored**: Mouse movement does NOT wake the UI (living room behavior)
- **5-Second Auto-Hide**: UI automatically hides after 5 seconds of inactivity
- **Always-On Playback**: Video player is always visible behind UI elements

### 4. **Fullscreen Management**
- **Default Fullscreen**: App starts in fullscreen mode (production)
- **Borderless Window**: No window chrome, title bar, or menu bar
- **F11 Toggle**: Quick fullscreen toggle for troubleshooting
- **Per-Profile Persistence**: Each profile remembers fullscreen preference

### 5. **State Persistence**
- **Last Channel**: Automatically restored on startup
- **Volume Level**: Per-profile volume saved
- **Fullscreen State**: Per-profile fullscreen preference
- **Audio-Only Mode**: Saved if active on shutdown
- **Clean Shutdown**: Stops playback cleanly and saves all state

### 6. **Keyboard Controls**
All existing keyboard shortcuts work, plus:
- **F11**: Toggle fullscreen
- **ESC**: Hide all overlays, return to playback
- **Any Key**: Show UI and reset auto-hide timer

## Implementation Details

### Profile Data Structure
New fields added to `ProfileData`:
```typescript
{
  isFullscreen?: boolean;      // Default: true (TV mode)
  audioOnlyMode?: boolean;      // Audio-only playback state
  autoLoginEnabled?: boolean;   // Auto-login on startup (default: true)
}
```

### Window Configuration
**main.ts** window creation:
```typescript
new BrowserWindow({
  frame: false,           // Borderless for TV appliance feel
  fullscreen: !isDev,     // Start fullscreen in production
  show: false,            // Prevent flash during load
  autoHideMenuBar: true,  // Hide menu bar
  // ... other options
});
```

### Custom Hooks

#### `useUIAutoHide(delay: number = 5000)`
Manages TV-style UI visibility:
- **Returns**: `{ isUIVisible, showUI, hideUI, resetTimer }`
- **Behavior**: 
  - Keyboard input shows/resets UI
  - Mouse movement ignored
  - Auto-hides after delay

#### `useFullscreen(profileSession, updateProfileData)`
Manages fullscreen with profile persistence:
- **Returns**: `{ isFullscreen, toggleFullscreen, setFullscreen }`
- **Behavior**:
  - Syncs fullscreen on mount/profile change
  - F11 key handling
  - Persists to profile data

### Auto-Login Flow
**ProfileApp.tsx** implements:
1. Check for `lastActiveProfileId` on mount
2. If profile exists and has no PIN → auto-login
3. Set `appState` to `Authenticated`
4. Fallback to `ProfileSelect` if auto-login fails

### Auto-Play Flow
**App.tsx** implements:
1. Restore last channel from profile settings
2. Call `playChannelWithFallback()` immediately
3. Start playback without user interaction
4. Show info overlay briefly, then auto-hide

### Clean Shutdown
**App.tsx** `beforeunload` handler:
1. Stop VLC playback cleanly
2. Save last channel ID
3. Save fullscreen state
4. Save audio-only mode
5. Save profile data to disk

## Development vs Production

### Development Mode
- Window has frame and title bar
- Starts in windowed mode (not fullscreen)
- Debug panels visible (Audio Normalization, Recording)
- Console logs enabled

### Production Mode
- Borderless fullscreen window
- Auto-login and auto-play enabled
- UI auto-hide active
- Minimal logging

## User Experience Flow

### First Launch
```
Start App
  ↓
No profiles exist
  ↓
Show Profile Select
  ↓
User creates profile
  ↓
Auto-login to new profile
  ↓
Load playlist (if configured)
  ↓
Start playback
```

### Subsequent Launches
```
Start App
  ↓
Auto-login last profile (TV Mode)
  ↓
Auto-play last channel
  ↓
Fullscreen playback
  ↓
UI auto-hides after 5s
```

### Navigation Pattern
```
Playback (UI hidden)
  ↓
Press any key → UI appears
  ↓
Navigate channels/categories
  ↓
5s inactivity → UI hides
  ↓
Back to Playback (UI hidden)
```

### Shutdown
```
User closes app
  ↓
beforeunload fires
  ↓
Stop VLC playback
  ↓
Save current channel
  ↓
Save fullscreen state
  ↓
Save profile data
  ↓
Clean exit
```

## Keyboard Reference (TV Mode)

### Playback Control
- **Arrow Keys**: Change channels/navigate UI
- **Number Keys**: Direct channel selection
- **Enter**: Select/Play
- **ESC**: Hide overlays, return to playback

### Toggles
- **I**: Show/hide info overlay
- **E**: Show/hide EPG now/next
- **G**: Show/hide full EPG guide
- **F**: Toggle favorite on current channel
- **F11**: Toggle fullscreen

### Menus
- **Ctrl+D**: Open donation jar
- **Ctrl+Shift+P**: Parental lock settings
- **O**: Open playlist file
- **L**: Load XMLTV EPG file

## Troubleshooting

### App Won't Start Fullscreen
- Check if running in development mode (starts windowed)
- Press **F11** to toggle fullscreen manually
- Verify `profileData.isFullscreen` is `true`

### Auto-Login Not Working
- Ensure profile has no PIN set
- Check `lastActiveProfileId` exists
- Verify `autoLoginEnabled` is `true` in profile data
- Check console for auto-login errors

### UI Won't Auto-Hide
- Ensure you're not moving the mouse (disables auto-hide)
- Press any key to reset the 5-second timer
- Check if an overlay is open (info, EPG, settings)

### Playback Doesn't Start
- Verify playlist is configured
- Check `lastChannelId` exists in profile settings
- Ensure channel URL is valid
- Look for playback errors in console

## Future Enhancements

Potential improvements for TV box mode:
- **Remote Control Support**: Direct infrared remote input
- **HDMI-CEC Integration**: TV power/volume control
- **Sleep Timer**: Auto-shutdown after inactivity
- **Channel Preview**: PIP mode for browsing
- **Voice Control**: Wake word activation
- **Network Status Indicator**: Connection health overlay
- **Recording Scheduler**: Time-based recording (TV box feature)

## Technical Notes

### Why Keyboard-Only UI Wake?
Living room TVs use remotes, not mice. Mouse movement from accidental table bumps would constantly wake the UI, disrupting the viewing experience.

### Why Borderless Window?
TV set-top boxes don't have window chrome. Removing frame, title bar, and menu bar creates an appliance-like experience that fills the entire screen.

### Why Auto-Login?
TV boxes don't require login every time you turn them on. The device remembers your settings and starts immediately.

### Why Auto-Play?
Turning on a TV should show content immediately, not a menu. The app behaves like a cable/satellite box that remembers your last channel.

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│         Electron Main Process           │
│  - Borderless fullscreen window         │
│  - IPC handlers (fullscreen, profile)   │
│  - Clean shutdown handler               │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│       Renderer Process (React)          │
├─────────────────────────────────────────┤
│  ProfileApp                             │
│    - Auto-login logic                   │
│    - Profile authentication flow        │
│    - Initializing → Authenticated       │
├─────────────────────────────────────────┤
│  App (Main TV UI)                       │
│    - useUIAutoHide (5s delay)           │
│    - useFullscreen (F11, persist)       │
│    - Auto-play last channel             │
│    - Keyboard event handling            │
│    - ESC overlay dismissal              │
│    - Clean shutdown (beforeunload)      │
├─────────────────────────────────────────┤
│  UI Components                          │
│    - Player (always visible)            │
│    - CategoryRail (conditional)         │
│    - ChannelList (conditional)          │
│    - Overlays (modal-style)             │
└─────────────────────────────────────────┘
```

## Testing TV Mode

### Manual Test Cases

1. **Auto-Login**
   - Close app
   - Relaunch
   - ✅ Should skip profile select and start playing

2. **Auto-Play**
   - Close app while watching a channel
   - Relaunch
   - ✅ Should resume last channel immediately

3. **UI Auto-Hide**
   - Press any key
   - Wait 5 seconds
   - ✅ UI should hide automatically

4. **Keyboard-Only Wake**
   - Let UI hide
   - Move mouse
   - ✅ UI should NOT appear
   - Press any key
   - ✅ UI should appear

5. **F11 Fullscreen Toggle**
   - Press F11
   - ✅ Should exit fullscreen
   - Press F11 again
   - ✅ Should enter fullscreen
   - Restart app
   - ✅ Should remember last fullscreen state

6. **ESC Overlay Dismissal**
   - Press 'G' to open EPG
   - Press ESC
   - ✅ EPG should close, return to playback
   - Press 'I' to show info
   - Press ESC
   - ✅ Info should hide

7. **Clean Shutdown**
   - Note current channel
   - Close app
   - Check console
   - ✅ Should log "Clean shutdown complete"
   - Relaunch
   - ✅ Should resume same channel

## Configuration

All TV mode settings are stored per-profile in:
```
{userData}/profiles/{profileId}/data.json
```

Example profile data:
```json
{
  "lastChannelId": "0x1a2b3c4d",
  "lastChannelIndex": 42,
  "volume": 75,
  "isFullscreen": true,
  "audioOnlyMode": false,
  "autoLoginEnabled": true,
  "favorites": [1, 5, 12, 23],
  "parentalControls": { ... },
  "epgPreferences": { ... }
}
```

## License

This feature is part of the JPTV IPTV Player project.

---

**Enjoy your TV box experience! 📺✨**
