# Windows Production Packaging Guide

## Overview

This document describes the Windows-native packaging configuration for JPTV Player, including VLC runtime bundling, crash reporting, and production builds.

## Build Configuration

### Application Identity

```json
{
  "appId": "com.jptv.iptv-player",
  "productName": "JPTV Player",
  "version": "1.0.0"
}
```

### Build Targets

- **NSIS Installer**: Full installer with start menu shortcuts and desktop icon
- **Portable**: Single-executable portable version (no installation required)
- **Architecture**: x64 only

## Features

### 1. DevTools Control

- **Development**: DevTools enabled and auto-opens
- **Production**: DevTools completely disabled via `devTools: false` in webPreferences

```typescript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, 'preload.js'),
  devTools: isDev // Disabled in production
}
```

### 2. Crash Reporter

Crash dumps are stored locally in the user data directory for debugging:

- **Location**: `%APPDATA%/jptv-player/crashes/`
- **Configuration**: No remote submission, local storage only
- **Compression**: Enabled for smaller dump files
- **Metadata**: Includes app version and platform

```typescript
crashReporter.start({
  productName: 'JPTV Player',
  companyName: 'JPTV',
  submitURL: '', // Local only
  uploadToServer: false,
  compress: true
});
```

### 3. VLC Runtime Bundling

The VLC runtime is fully bundled with the application for standalone deployment:

#### Bundled Files
- `libvlc.dll`
- `libvlccore.dll`
- `plugins/**/*` (all VLC plugins)

#### Source Location
```
C:/Program Files/VideoLAN/VLC/
```

#### Destination in Build
```
<app-resources>/vlc/
```

#### Runtime Initialization
In production, the app automatically:
1. Detects bundled VLC in `process.resourcesPath/vlc/`
2. Sets `VLC_PLUGIN_PATH` environment variable
3. Falls back to system VLC if bundled version not found

```typescript
if (!isDev) {
  const vlcPath = path.join(process.resourcesPath, 'vlc');
  const pluginPath = path.join(vlcPath, 'plugins');
  
  if (fs.existsSync(vlcPath)) {
    process.env.VLC_PLUGIN_PATH = pluginPath;
  }
}
```

### 4. Native Addon Bundling

The compiled VLC player addon is included in the build:

```json
"files": [
  "dist/**/*",
  "package.json",
  "node_modules/node-addon-api/**/*",
  "build/Release/vlc_player.node"
]
```

## User Data Locations

All user data is stored in `%APPDATA%/jptv-player/`:

| Data Type | Path | Description |
|-----------|------|-------------|
| Settings | `settings.json` | User preferences, last channel, history |
| Logs | `logs/vlc-player.log` | Rotating logs (5MB × 5 files) |
| Crash Dumps | `crashes/` | Minidump files for debugging |

## Building for Production

### Prerequisites

1. **VLC SDK**: Install VLC 3.0+ at `C:\Program Files\VideoLAN\VLC\`
2. **Node.js**: v18 or later
3. **Build Tools**: Visual Studio 2019+ or Build Tools for Visual Studio

### Environment Variables

```powershell
$env:VLC_INCLUDE = "C:\Program Files\VideoLAN\VLC\sdk\include"
$env:VLC_LIB = "C:\Program Files\VideoLAN\VLC\sdk\lib"
```

### Build Commands

```bash
# Install dependencies
npm install

# Build native addon
npm run build:native

# Build Electron app
npm run build

# Create distributable packages
npm run dist
```

### Output

Packages are created in `release/`:

- `JPTV Player-1.0.0-x64.exe` - NSIS installer
- `JPTV Player-1.0.0-Portable.exe` - Portable executable

## Installer Options

### NSIS Installer
- **One-Click**: Disabled (user can choose install location)
- **Elevation**: Enabled (allows installation to Program Files)
- **Shortcuts**: Desktop + Start Menu
- **Uninstall**: Preserves user data by default

### Portable Version
- **No Installation**: Runs directly from any location
- **User Data**: Stored in `%APPDATA%` (not relative to executable)
- **Perfect for**: USB drives, network shares, testing

## Testing Production Builds

### 1. Verify VLC Bundling

After building, check that VLC runtime is included:

```
release/win-unpacked/resources/vlc/
  ├── libvlc.dll
  ├── libvlccore.dll
  └── plugins/
      ├── access/
      ├── audio_output/
      ├── codec/
      └── ...
```

### 2. Verify Native Addon

Ensure the VLC player addon is present:

```
release/win-unpacked/build/Release/vlc_player.node
```

### 3. Test DevTools Disabled

Launch the production build and verify:
- Right-click context menu has no "Inspect" option
- F12 key does nothing
- DevTools cannot be opened

### 4. Test Crash Reporter

Check that crash dumps are created in:
```
%APPDATA%/jptv-player/crashes/
```

## Distribution

The built packages can be distributed directly without requiring:
- Separate VLC installation
- Runtime dependencies (fully self-contained)
- Administrator rights for portable version

## Troubleshooting

### VLC Not Found Error

If the app reports "VLC not found" in production:

1. Verify `extraResources` in package.json includes VLC path
2. Check that VLC is installed at `C:/Program Files/VideoLAN/VLC/`
3. Rebuild the distribution package

### Native Addon Error

If "Native addon not found" appears:

1. Run `npm run build:native` before `npm run dist`
2. Verify `build/Release/vlc_player.node` exists
3. Check that `files` array in package.json includes the addon

### Crash Dumps Not Created

If crashes don't generate dumps:

1. Verify crash reporter is initialized (check main.ts)
2. Check that `%APPDATA%/jptv-player/crashes/` directory exists
3. Ensure crash occurred in main process (renderer crashes not captured)

## Security Notes

1. **Code Signing**: Consider signing the executable with a code signing certificate for production distribution
2. **Auto-Updates**: Can be added using `electron-updater` if needed
3. **User Data**: Settings and logs stored in user profile, not shared between users

## Performance

- **Startup Time**: ~1-2 seconds (includes VLC initialization)
- **Memory Usage**: ~100-150MB idle, ~200-300MB during playback
- **Disk Space**: ~100MB installed (includes VLC runtime + plugins)

## Version History

- **v1.0.0**: Initial production release with full VLC bundling
