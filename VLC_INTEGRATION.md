# VLC Player Integration Guide

This guide explains how to build and use the VLC-based video player in the JPTV Player application.

## Prerequisites

### 1. Install VLC Media Player SDK

Download and install VLC for Windows:
- **VLC Player**: https://www.videolan.org/vlc/download-windows.html
- **VLC SDK**: Download the SDK from https://download.videolan.org/pub/videolan/vlc/

Extract the SDK to: `C:\Program Files\VideoLAN\VLC\sdk`

Or set environment variables:
```powershell
$env:VLC_INCLUDE = "C:\path\to\vlc\sdk\include"
$env:VLC_LIB = "C:\path\to\vlc\sdk\lib"
```

### 2. Install Build Tools

Install Visual Studio Build Tools:
```powershell
# Install Windows Build Tools
npm install --global windows-build-tools

# Or install Visual Studio Community 2022
# With "Desktop development with C++" workload
```

### 3. Install Python (for node-gyp)

```powershell
# Install Python 3.11 or later
choco install python311

# Or download from python.org
```

## Building the Native Addon

### 1. Install Dependencies

```powershell
cd jptv-player
npm install
```

This will install:
- `node-addon-api` - N-API C++ wrapper
- `node-gyp` - Native addon build tool

### 2. Build the VLC Addon

```powershell
npm run build:native
```

This compiles `native/vlc_player.cpp` into `build/Release/vlc_player.node`

**Troubleshooting:**

If build fails with "Cannot find module 'C:\Program Files\VideoLAN\VLC\sdk\lib\libvlc.lib'":
1. Verify VLC SDK path in `binding.gyp`
2. Update paths to match your VLC installation
3. Ensure both 32-bit and 64-bit libraries are available

### 3. Build Electron App

```powershell
npm run build
```

This compiles TypeScript and prepares the app for distribution.

## Architecture

```
┌─────────────────┐
│   React UI      │  (VlcPlayerAdapter.ts)
│   (Renderer)    │
└────────┬────────┘
         │ IPC
         ▼
┌─────────────────┐
│  Electron Main  │  (main.ts)
│    Process      │
└────────┬────────┘
         │ Node.js require()
         ▼
┌─────────────────┐
│  Native Addon   │  (vlc_player.node)
│   (C++ / VLC)   │
└────────┬────────┘
         │ libVLC API
         ▼
┌─────────────────┐
│  VLC Libraries  │  (libvlc.dll)
│                 │
└─────────────────┘
```

## Usage

### Starting Playback

When user selects a channel (Enter key):

1. **VlcPlayerAdapter** calls `window.electronAPI.player.play(url)`
2. **IPC Bridge** (preload.ts) forwards to main process
3. **Main Process** (main.ts) calls native addon: `vlcPlayer.play(url)`
4. **Native Addon** (C++) calls `libvlc_media_new_location()` and `libvlc_media_player_play()`
5. Video renders to the window HWND

### Player States

The player reports these states:
- `stopped` - No media loaded
- `buffering` - Loading stream
- `playing` - Active playback
- `paused` - Playback paused
- `error` - Playback failed

States are shown in the UI via the playback overlay (bottom-right corner).

### Controls

| Action | Key | Function |
|--------|-----|----------|
| Play Channel | Enter | Start playback of selected channel |
| Volume Up | ↑ (in player mode) | Increase volume by 5 |
| Volume Down | ↓ (in player mode) | Decrease volume by 5 |
| Pause/Resume | Space | Toggle playback |
| Back to Channels | Esc | Exit player mode |

### Error Handling

If playback fails:
1. VLC returns error to native addon
2. Main process returns `{ success: false, error: "message" }`
3. VlcPlayerAdapter catches error and updates state to `'error'`
4. UI shows red error overlay: "⚠ Playback failed"
5. Error auto-dismisses after 5 seconds

## API Reference

### VlcPlayerAdapter (TypeScript)

```typescript
class VlcPlayerAdapter implements PlayerAdapter {
  // Play a stream URL (stops current playback first)
  async play(url: string): Promise<void>
  
  // Stop playback
  async stop(): Promise<void>
  
  // Pause playback
  async pause(): Promise<void>
  
  // Resume playback
  async resume(): Promise<void>
  
  // Set volume (0-100)
  async setVolume(volume: number): Promise<void>
  
  // Get current volume
  async getVolume(): Promise<number>
  
  // Get player statistics
  async getStats(): Promise<PlayerStats>
  
  // Check if playing
  isPlaying(): boolean
  
  // Register state change callback
  onStateChange(callback: (state) => void): void
}
```

### Native Addon (C++)

```cpp
// Initialize player with window handle
bool initialize(HWND hwnd)

// Play URL
bool play(const std::string& url)

// Stop playback
bool stop()

// Pause playback
bool pause()

// Resume playback
bool resume()

// Set volume (0-100)
bool setVolume(int volume)

// Get volume
int getVolume()

// Check if playing
bool isPlaying()

// Get state ("playing", "paused", "stopped", "buffering", "error")
std::string getState()
```

## Debugging

### Enable VLC Logs

Add `--verbose=2` to VLC args in `vlc_player.cpp`:

```cpp
const char* vlc_args[] = {
    "--verbose=2",  // Add this
    "--no-video-title-show",
    ...
};
```

### Check Addon Loading

Look for console output:
```
[VLC] Player initialized successfully
```

If you see:
```
[VLC] Native addon not found at: ...
[VLC] Run "npm run build:native" to compile the addon
```

Run: `npm run build:native`

### Test VLC Installation

```cpp
// In native/vlc_player.cpp, add after libvlc_new():
printf("VLC Version: %s\n", libvlc_get_version());
```

Rebuild and check console for VLC version.

## Performance Tuning

### Network Caching

Default: 3000ms (3 seconds)

Adjust in `vlc_player.cpp`:
```cpp
"--network-caching=5000",  // 5 seconds for slower connections
```

### Hardware Acceleration

Enable GPU decoding (may reduce CPU usage):
```cpp
"--avcodec-hw=d3d11va",  // DirectX 11 hardware acceleration
```

Add to `vlc_args[]` array in `initialize()`.

## Distribution

When packaging the app with `npm run dist`:

1. Ensure `vlc_player.node` is in `build/Release/`
2. Copy VLC DLLs to app resources:
   - `libvlc.dll`
   - `libvlccore.dll`
   - `plugins/` directory

Update `package.json` build config:
```json
"build": {
  "files": [
    "dist/**/*",
    "build/Release/vlc_player.node",
    "vlc-libs/**/*"
  ]
}
```

## Troubleshooting

### "Cannot find module 'vlc_player.node'"

**Solution**: Run `npm run build:native`

### "Failed to initialize player"

**Causes**:
1. VLC not installed
2. Missing VLC DLLs (libvlc.dll, libvlccore.dll)
3. Incompatible VLC version (requires 3.0.0+)

**Solution**: Install VLC 3.0+ and ensure DLLs are in PATH or app directory

### "Playback failed" on all streams

**Causes**:
1. Network firewall blocking
2. Invalid stream URLs
3. Missing VLC codec plugins

**Solution**: 
- Test URL in standalone VLC player first
- Check firewall settings
- Reinstall VLC with all codec packs

### Black screen but audio plays

**Cause**: HWND not set correctly

**Solution**: Verify window handle in `initializeVlcPlayer()`:
```typescript
const hwnd = mainWindow.getNativeWindowHandle();
const hwndValue = hwnd.readBigInt64LE(0);
```

## Development Tips

### Rapid Testing

Use the stub player during UI development:
```typescript
// In App.tsx
import { StubPlayerAdapter } from './player/PlayerAdapter';
const playerAdapter = new StubPlayerAdapter();
```

Switch back to VLC for testing actual playback:
```typescript
import { VlcPlayerAdapter } from './player/VlcPlayerAdapter';
const playerAdapter = new VlcPlayerAdapter();
```

### Memory Leaks

The VLC instance is reused across channels. To verify cleanup:
```cpp
// In ~VlcPlayer() destructor
printf("Cleaning up VLC player\n");
```

Check console when app closes.

## Next Steps

1. **EPG Integration** - Add electronic program guide
2. **Recording** - Implement stream recording via VLC
3. **Timeshift** - Buffer live TV for pause/rewind
4. **Subtitles** - Enable closed captions via VLC SPU tracks

See `IMPLEMENTATION.md` for roadmap.
