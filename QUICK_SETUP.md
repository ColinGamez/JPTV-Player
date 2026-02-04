# Quick Setup Guide

## Prerequisites

1. **Install VLC SDK**
   - Download from: https://download.videolan.org/pub/videolan/vlc/
   - Extract to: `C:\Program Files\VideoLAN\VLC\sdk`

2. **Install Build Tools**
   ```powershell
   # Option 1: Visual Studio 2022 Community
   # With "Desktop development with C++" workload
   
   # Option 2: Build Tools only
   npm install --global windows-build-tools
   ```

## Build & Run

```powershell
# 1. Install dependencies
npm install

# 2. Build native VLC addon
npm run build:native

# 3. Run the app
npm run dev
```

## Test Playback

1. Press `O` to open playlist
2. Select `sample-playlist.m3u8` or `jptv.m3u8`
3. Use arrow keys to navigate channels
4. Press `Enter` to play

## Troubleshooting

### "Cannot find VLC SDK"

Update paths in `binding.gyp`:
```json
"include_dirs": [
  "C:/YourPath/VLC/sdk/include"
],
"libraries": [
  "-lC:/YourPath/VLC/sdk/lib/libvlc.lib"
]
```

### "Failed to initialize player"

Install VLC runtime:
- Download: https://www.videolan.org/vlc/
- Or copy DLLs: `libvlc.dll`, `libvlccore.dll` to app folder

### Build fails

Ensure you have:
- Visual Studio 2022 Build Tools
- Python 3.11+
- Node.js 18+

## What You Get

- ✅ Real VLC-based video player (not stub)
- ✅ Channel playback with Enter key
- ✅ Buffering indicator
- ✅ Error handling with overlay
- ✅ Volume control (↑/↓)
- ✅ Pause/resume (Space)

## Documentation

- **VLC_INTEGRATION.md** - Full API reference and troubleshooting
- **BUILD_INSTRUCTIONS.md** - Detailed build guide
- **VLC_IMPLEMENTATION_SUMMARY.md** - Architecture and implementation details
