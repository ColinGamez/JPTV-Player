# Electronic Program Guide (EPG) System

## Overview

The JPTV Player includes a comprehensive EPG system that supports XMLTV format for displaying program information, including current/next programs and a full program guide grid.

## Features

### Backend
- **XMLTV Parser**: Full support for XMLTV format with timezone handling (JST)
- **Efficient Indexing**: Map-based storage for O(1) channel lookup
- **Binary Search**: Fast now/next program lookups using binary search
- **Persistent Cache**: 6-hour TTL cache stored in userData directory
- **Graceful Error Handling**: Skips malformed entries without failing entire parse
- **Performance**: Supports 200+ channels with 48+ hours of program data

### UI Components

#### 1. Now/Next Overlay (Press E)
- Shows current program with progress bar
- Displays next program information
- Auto-hides after 5 seconds
- Wii-styled glossy interface

#### 2. Full Program Guide Grid (Press G)
- Virtualized scrolling grid for 200+ channels
- 48-hour time window with 30-minute slots
- Color-coded programs by category
- Synchronized scrolling (time header + channel sidebar)
- Program selection with details panel

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `E` | Toggle Now/Next overlay for current channel |
| `G` | Open/close full program guide grid |
| `L` | Load XMLTV file (file picker) |
| `I` | Toggle channel info overlay |
| `Escape` | Close overlays / return to channel list |

## Architecture

### Data Flow

```
XMLTV File → Parser → EPG Manager → IPC → React Hook → UI Components
                         ↓
                    Cache (6hr TTL)
```

### Key Components

#### Backend (Electron Main Process)

1. **xmltv-parser.ts**
   - `parseXmltvTime()`: Converts XMLTV timestamps to Unix time
   - `parseXmltvFile()`: Async XML parsing with xml2js
   - Handles timezone conversion (supports JST)
   - Returns structured channel and program data

2. **epg-manager.ts**
   - `EpgManager`: Main EPG data manager class
   - `initialize()`: Loads from cache if valid
   - `loadFromXmltv()`: Parses and caches XMLTV data
   - `getNowNext()`: Binary search for current/next programs
   - `getGuideWindow()`: Multi-channel time window queries
   - `saveToCache()` / `loadFromCache()`: TTL-based persistence

3. **IPC Handlers** (in main.ts)
   - `epg:loadXmltv` - Load XMLTV file by path
   - `epg:openXmltvFile` - Show file picker + load
   - `epg:getNowNext` - Get current/next for channel
   - `epg:getGuideWindow` - Multi-channel time window
   - `epg:getProgramsForDate` - Day view for channel
   - `epg:getChannel` - Get channel metadata
   - `epg:getAllChannels` - List all EPG channels
   - `epg:getStats` - Get load status and counts
   - `epg:clear` - Clear all EPG data

#### Frontend (React Renderer Process)

1. **useEpgData Hook**
   - Manages EPG state (nowNext, guideWindow, channels, stats)
   - Auto-refresh every 60 seconds (configurable)
   - Loads EPG stats on mount
   - Provides actions: loadXmltvFile, refreshNowNext, loadGuideWindow, clearEpg

2. **NowNextOverlay Component**
   - Displays current program with progress (0-100%)
   - Shows next program title and start time
   - Auto-hide timer (5 seconds)
   - Wii-styled glossy card design

3. **FullGuideGrid Component**
   - Virtualized scrolling for performance
   - 2D grid: channels (rows) × time slots (columns)
   - Synchronized scroll areas (header, sidebar, grid)
   - Program blocks sized by duration
   - Category-based color coding
   - Details panel on program selection

### Data Structures

#### EpgChannel
```typescript
{
  id: string;          // Channel identifier
  displayName: string; // Display name
  icon?: string;       // Optional icon URL
}
```

#### EpgProgram
```typescript
{
  channelId: string;
  title: string;
  description?: string;
  start: number;       // Unix timestamp (ms)
  stop: number;        // Unix timestamp (ms)
  categories?: string[];
  credits?: {
    actors?: string[];
    directors?: string[];
    writers?: string[];
  };
}
```

#### EpgNowNext
```typescript
{
  currentProgram?: EpgProgram;
  nextProgram?: EpgProgram;
  progress: number;    // 0-1 (0% to 100%)
}
```

#### EpgGuideWindow
```typescript
{
  startTime: number;
  endTime: number;
  data: Map<string, EpgProgram[]>;  // channelId → programs
}
```

## Usage

### Loading EPG Data

1. Press `L` to open file picker
2. Select an XMLTV file (`.xml` or `.xmltv`)
3. Parser automatically:
   - Parses XML structure
   - Converts timezones to JST
   - Indexes programs by channel
   - Saves to cache with TTL
   - Updates UI

### Viewing Program Information

**Quick View (Now/Next):**
1. Select a channel and start playing
2. Press `E` to show Now/Next overlay
3. View current program progress and next program
4. Overlay auto-hides after 5 seconds

**Full Guide:**
1. Press `G` to open full program guide
2. Scroll horizontally (time) and vertically (channels)
3. Click program blocks for details
4. Press `Escape` or close button to exit

### Cache Management

- **TTL**: 6 hours (configurable in EPG_DEFAULT_TTL)
- **Location**: `{userData}/epg-cache.json`
- **Auto-refresh**: Cached data loads on startup if valid
- **Manual clear**: Call `window.electron.epg.clear()`

## Performance Optimizations

1. **Binary Search**: O(log n) now/next lookups instead of linear scan
2. **Map Indexing**: O(1) channel lookup with Map<channelId, programs[]>
3. **Pre-sorting**: Programs sorted by start time during parse
4. **Async Parsing**: xml2js runs asynchronously, won't block UI
5. **TTL Cache**: Fast startup (<500ms) when cache is valid
6. **Virtualized Rendering**: Only renders visible grid cells

## Category Colors

Programs are color-coded by category in the full guide:

- **News**: Red (#ff6b6b)
- **Sports**: Green (#51cf66)
- **Drama**: Purple (#be4bdb)
- **Movie**: Yellow (#ffd43b)
- **Variety**: Orange (#ff8c42)
- **Documentary**: Blue (#339af0)
- **Anime**: Pink (#f06595)
- **Default**: Blue (#4a9eff)

## Troubleshooting

### EPG Not Loading
- Check XMLTV file format (must be valid XML)
- Verify channel IDs match between M3U and XMLTV
- Check console for parse errors
- Clear cache: `window.electron.epg.clear()`

### Performance Issues
- Reduce time window (default 48 hours)
- Check program count with `window.electron.epg.getStats()`
- Ensure cache is being used (check parse time: <500ms = cached)

### Missing Programs
- Verify XMLTV file has programs for channel
- Check timezone conversion (should be JST)
- Ensure program times are within cache window

### Grid Not Scrolling
- Check browser console for React errors
- Verify channel count (should support 200+)
- Ensure virtualization is working (only visible cells rendered)

## Development

### Adding New Features

1. **Backend**: Add IPC handler in `main.ts`
2. **Types**: Update `src/types/epg.ts` and `electron.d.ts`
3. **Preload**: Expose handler in `preload.ts`
4. **Hook**: Add method to `useEpgData`
5. **UI**: Create/update component

### Testing

```typescript
// Get EPG stats
const stats = await window.electron.epg.getStats();
console.log(`Loaded: ${stats.isLoaded}, Channels: ${stats.channels}`);

// Get now/next for channel
const nowNext = await window.electron.epg.getNowNext('NHK総合');
console.log(`Current: ${nowNext?.currentProgram?.title}`);

// Load guide window
const guide = await window.electron.epg.getGuideWindow(
  ['NHK総合', 'NHK教育'],
  Date.now(),
  Date.now() + 3600000 // +1 hour
);
```

## Future Enhancements

- [ ] Automatic XMLTV downloads/updates
- [ ] Recording scheduling based on EPG
- [ ] Search programs by title/description
- [ ] Favorites/reminders for programs
- [ ] Extended metadata (ratings, episode info)
- [ ] Multiple language support
- [ ] EPG-based channel recommendations
