# JPTV Player - Keyboard Shortcuts Reference

## Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate categories (when focused on category rail) |
| `↑` / `↓` | Navigate channels (when focused on channel list) |
| `←` | Move focus to category rail |
| `→` | Move focus to channel list |
| `Enter` | Select category / Play channel |
| `Escape` | Return to channel list from player |

## Numeric Input

| Key | Action |
|-----|--------|
| `0-9` | Direct channel number entry (buffer mode) |
| - | Type channel number, then press Enter or wait 2 seconds |

## Playback & Channel Info

| Key | Action |
|-----|--------|
| `I` | Toggle channel information overlay |
| `O` | Open M3U playlist file (file picker) |
| `F` | Toggle favorite status for current channel |

## EPG (Electronic Program Guide)

| Key | Action |
|-----|--------|
| `E` | Toggle Now/Next overlay (current + next program) |
| `G` | Open/close full program guide grid |
| `L` | Load XMLTV EPG file (file picker) |

## Development Features

| Key | Action | Availability |
|-----|--------|--------------|
| `R` | Toggle recording for current channel | Dev mode only |
| `A` | Toggle audio-only mode | Dev mode only |

## EPG Features

### Now/Next Overlay (E key)
- Current program title and description
- Progress bar (0-100%)
- Next program title and start time
- Auto-hides after 5 seconds

### Full Program Guide (G key)
- 48-hour time window
- 200+ channels supported
- 30-minute time slots
- Scroll horizontally (time) and vertically (channels)
- Click programs for detailed information
- Category-based color coding

### EPG Data Loading (L key)
- Opens file picker for XMLTV files
- Automatically parses and caches EPG data
- 6-hour cache TTL
- Supports Japanese timezone (JST)
- Handles 200+ channels efficiently

## Tips

### Numeric Channel Entry
1. Type channel number (e.g., `1`, `2`, `3` for channel 123)
2. Either:
   - Press `Enter` to jump immediately
   - Wait 2 seconds for auto-jump

### EPG Usage
1. Load EPG data first (press `L`, select XMLTV file)
2. Navigate to any channel
3. Press `E` for quick current/next info
4. Press `G` for full multi-channel guide

### Favorites
- Press `F` while watching a channel to add/remove favorite
- Favorites are persisted to settings
- Filter by "お気に入り" category to see favorites only

## Status Indicators

### Playback States
- **Buffering**: Spinning indicator with "Buffering..." text
- **Error**: ⚠ symbol with error message (auto-hides after 5 seconds)
- **Playing**: Clean player view with optional info overlay

### Health Status
- **Healthy**: Green badge (🟢 Healthy)
- **Issues**: Yellow badge (🟡 Issues)
- **Down**: Red badge (🔴 Down)
- **Unknown**: Gray badge (⚪ Unknown)

### EPG Status
- **Loading**: "Loading guide data..." in grid
- **No Data**: "No EPG data available for this channel"
- **Loaded**: Program information displayed

## Audio Normalization (Dev Mode)

### Panel
- Located in bottom-right corner
- Shows current channel audio level
- Displays applied gain correction
- Click to expand/collapse

### Features
- Per-channel audio tracking
- Target level: -23 dB LUFS
- Gain range: ±12 dB
- Exponential moving average (α = 0.3)
- Persistent storage via localStorage

## Recording (Dev Mode)

### Starting Recording
- Press `R` while watching a channel
- Recording indicator appears in top-right
- Shows recording duration

### Stopping Recording
- Press `R` again to stop
- Or click "Stop Recording" button on overlay

### Recording Info
- Saved to: `Videos/JPTV Recordings/{channelName}_{timestamp}.ts`
- Format: MPEG-TS (no re-encoding)
- Real-time streaming to disk

## UI Theme

### Wii-Inspired Design
- Light gradient backgrounds (#e8f0f8 → #d0e4f5)
- Glossy rounded buttons with shine effects
- Soft shadows and blue accents (#4a9eff)
- 2-column grid layout for channels
- Pulsing animations for selected items

### Color Scheme
- Primary Blue: #4a9eff
- Background: Light gradient
- Text: Dark blue (#1a3a52)
- Accent: Soft shadows with blur

## System Requirements

- **Electron**: v28.1.3+
- **VLC**: 3.x with native addon
- **OS**: Windows (primary), macOS, Linux
- **Memory**: 2GB+ for EPG with 200+ channels
- **Storage**: 50MB+ for EPG cache

## Troubleshooting

### No Playback
1. Check VLC is installed
2. Verify stream URLs are valid
3. Check network connectivity
4. Try alternate URLs (automatic fallback enabled)

### EPG Not Loading
1. Verify XMLTV file format
2. Check channel ID matching
3. Clear cache: Developer console → `window.electron.epg.clear()`
4. Reload XMLTV file

### Performance Issues
1. Close full program guide if not needed
2. Clear EPG cache if too large
3. Reduce EPG time window
4. Check system memory usage

### Audio Issues
1. Check VLC audio output settings
2. Verify stream has audio track
3. Try disabling audio normalization
4. Check system volume mixer

## Developer Console Commands

```javascript
// EPG Stats
await window.electron.epg.getStats()

// Get Channel EPG
await window.electron.epg.getNowNext('NHK総合')

// Clear EPG Cache
await window.electron.epg.clear()

// Load XMLTV File
await window.electron.epg.loadXmltv('/path/to/file.xml')

// Audio Level (when playing)
await window.electron.vlc.getAudioLevel()

// Set Audio Gain
await window.electron.vlc.setAudioGain(-3.0) // -3 dB
```

## Support

For issues, feature requests, or questions:
- Check `EPG_GUIDE.md` for detailed EPG documentation
- Review console logs for error messages
- Verify XMLTV and M3U file formats
- Check VLC addon installation
