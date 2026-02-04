# EPG Pro System - Professional Electronic Program Guide

## Overview

This document describes the **EPG Pro** system - a professional-grade electronic program guide (EPG) for your IPTV application. This system provides fast, virtualized rendering of 200+ channels with 48-72 hours of program data, search capabilities, filtering, and profile-scoped preferences.

## Features

### Core Capabilities
- **Virtualized Grid UI**: Fast rendering of 200+ channels using `react-window`
- **Full 48-72 Hour View**: Configurable time spans (24h/48h/72h)
- **Token-Based Search**: Fast program search with title, description, and category indexing
- **Profile-Scoped Preferences**: Per-user EPG settings (time span, filters, view state)
- **Keyboard-First Navigation**: Full keyboard control with shortcuts
- **Japanese UTF-8 Support**: Native Japanese text throughout
- **Channel Filters**: Hide/show channels, categories, favorites-only mode
- **Program Details**: Rich program information with watch/reminder actions

## Architecture

### Data Layer

#### EpgStore (`src/epg/EpgStore.ts`)
The heart of the EPG system - a high-performance data store with indexing.

**Key Features:**
- Map-based channel indexing for O(1) channel lookups
- Binary search for O(log n) time-based queries
- Token-based inverted index for fast search
- Singleton pattern for global access

**Public API:**
```typescript
interface EpgStore {
  setChannelPrograms(channelId: string, programs: EpgProgram[]): void;
  getNow(channelId: string): EpgProgram | null;
  getNext(channelId: string): EpgProgram | null;
  getProgramsInRange(channelId: string, startTime: number, endTime: number): EpgProgram[];
  searchPrograms(query: string, maxResults?: number): SearchResult[];
}
```

**Usage:**
```typescript
import { getEpgStore } from './epg/EpgStore';

const epgStore = getEpgStore();

// Load programs for a channel
epgStore.setChannelPrograms('channel-1', [
  {
    title: 'ニュース',
    start: 1700000000000,
    end: 1700003600000,
    description: '最新ニュース',
    category: 'ニュース'
  },
  // ...more programs
]);

// Get current program
const now = epgStore.getNow('channel-1');

// Search programs
const results = epgStore.searchPrograms('ニュース', 50);
```

### Profile Integration

#### EPG Preferences (`src/types/profile.ts`)
Eight EPG settings are stored per-profile in `ProfileData`:

```typescript
interface ProfileData {
  // ...existing fields
  
  // EPG Pro preferences
  epgEnabled?: boolean;                    // Enable/disable EPG (default: true)
  epgTimeSpanHours?: number;               // 24, 48, or 72 hours (default: 48)
  epgTimeBlockMinutes?: number;            // 15, 30, or 60 minutes (default: 30)
  epgChannelOrder?: 'playlist' | 'alphabetical' | 'favorites-first';
  epgHiddenCategories?: string[];          // Hidden program categories
  epgHiddenChannels?: string[];            // Hidden channel IDs
  epgFavoritesOnly?: boolean;              // Show only favorite channels
  lastEpgViewState?: {                     // Restore scroll/focus position
    scrollX?: number;
    scrollY?: number;
    focusedChannelId?: string;
    focusedTimeMs?: number;
  };
}
```

#### useEpgPreferences Hook (`src/hooks/useEpgPreferences.ts`)
Manages EPG preferences for a profile session.

**API:**
```typescript
const { prefs, updatePrefs, saveViewState, resetPrefs } = useEpgPreferences(profileSession);

// Update preferences
updatePrefs({ epgTimeSpanHours: 72, epgFavoritesOnly: true });

// Save scroll/focus state
saveViewState({ scrollX: 1000, scrollY: 500, focusedChannelId: 'ch-1', focusedTimeMs: Date.now() });

// Reset to defaults
resetPrefs();
```

## UI Components

### 1. EpgGrid Component (`src/components/EpgGrid.tsx`)
The main virtualized grid display.

**Props:**
```typescript
interface EpgGridProps {
  epgStore: EpgStore;
  channels: Array<{ id: string; name: string; logo?: string; isFavorite?: boolean }>;
  timeSpanHours: number;              // 24, 48, or 72
  timeBlockMinutes: number;           // 15, 30, or 60
  favorites: string[];                // Channel IDs
  hiddenCategories?: string[];
  onSelectProgram: (program: EpgProgram, channelId: string) => void;
  onFocusChange: (channelId: string, timeMs: number, scrollX: number, scrollY: number) => void;
  initialScrollX?: number;
  initialScrollY?: number;
  initialFocusedChannelId?: string;
  initialFocusedTimeMs?: number;
}
```

**Features:**
- Virtualized rendering with `react-window`
- Time ruler with synchronized horizontal scroll
- "Now" line indicator at current time
- Program blocks with progress bars for live shows
- Keyboard navigation (arrows, PageUp/Down, Home/End, Enter)
- Focus tracking and restoration

**Layout Constants:**
- `CHANNEL_ROW_HEIGHT`: 60px
- `TIME_BLOCK_WIDTH_PX`: 200px (per time block)
- `CHANNEL_COLUMN_WIDTH`: 180px
- `TIME_RULER_HEIGHT`: 50px

### 2. EpgDetailsPanel Component (`src/components/EpgDetailsPanel.tsx`)
Displays detailed program information.

**Props:**
```typescript
interface EpgDetailsPanelProps {
  program: EpgProgram;
  channelName: string;
  onWatch: () => void;        // Tune to channel (if live)
  onReminder: () => void;     // Set reminder (if upcoming)
  onClose: () => void;
}
```

**Display Sections:**
- Title (large header)
- Channel name
- Time range with duration
- Status badge: 放送中 (live/red), 放送予定 (upcoming/blue), 放送終了 (past/gray)
- Category badge
- Description text

**Actions:**
- "▶ 視聴する" button (if currently airing)
- "🔔 リマインダー設定" button (if upcoming)
- Disabled message if past

### 3. EpgSearch Component (`src/components/EpgSearch.tsx`)
Search UI for finding programs.

**Props:**
```typescript
interface EpgSearchProps {
  epgStore: EpgStore;
  channels: Array<{ id: string; name: string }>;
  onSelectResult: (channelId: string, timeMs: number, programTitle: string) => void;
  onClose: () => void;
  isOpen: boolean;
}
```

**Features:**
- Query input with 300ms debounce
- Results grouped by date
- Keyboard navigation (arrows, Enter, ESC)
- Result click jumps grid to program
- Shows title, channel, time, description snippet
- Search help text when empty

### 4. EpgFilters Component (`src/components/EpgFilters.tsx`)
Filter controls for EPG.

**Props:**
```typescript
interface EpgFiltersProps {
  favoritesOnly: boolean;
  channelOrder: 'playlist' | 'alphabetical' | 'favorites-first';
  timeSpanHours: number;
  timeBlockMinutes: number;
  hiddenCategories: string[];
  hiddenChannels: string[];
  allCategories: string[];
  allChannels: Array<{ id: string; name: string }>;
  onToggleFavoritesOnly: () => void;
  onSetChannelOrder: (order) => void;
  onSetTimeSpan: (hours: number) => void;
  onSetTimeBlock: (minutes: number) => void;
  onToggleCategory: (category: string) => void;
  onToggleChannel: (channelId: string) => void;
  onResetFilters: () => void;
  onClose: () => void;
  isOpen: boolean;
}
```

**Controls:**
- Favorites only toggle
- Channel order radio buttons
- Time span buttons (24h/48h/72h)
- Time block buttons (15min/30min/60min)
- Category checkboxes (show/hide)
- Channel checkboxes (show/hide)
- Reset button

### 5. EpgScreen Component (`src/components/EpgScreen.tsx`)
Main EPG screen container - integrates all components.

**Props:**
```typescript
interface EpgScreenProps {
  profileSession: ProfileSession;
  channels: Array<{ id: string; name: string; logo?: string; category?: string; isFavorite?: boolean }>;
  epgStore: EpgStore;
  onTuneChannel: (channelId: string) => void;
  onClose: () => void;
  isOpen: boolean;
}
```

**Features:**
- Full-screen modal overlay
- Header with title and action buttons
- Integrates EpgGrid, EpgDetailsPanel, EpgSearch, EpgFilters
- Manages state for selected program, search, filters
- Keyboard shortcuts handling
- View state persistence on close

**Header Actions:**
- 🔍 Search button (opens EpgSearch)
- ⚙️ Filter button (opens EpgFilters)
- × Close button

**Footer Help:**
- G: 閉じる
- Ctrl+F: 検索
- 矢印: 移動
- Enter: 選択

## Keyboard Shortcuts

### Global (EPG Screen)
- **G** or **g**: Toggle EPG on/off
- **Escape**: Close EPG (or close modal if search/filters open)
- **Ctrl+F**: Open search
- **Ctrl+Shift+F**: Open filters

### Grid Navigation
- **Arrow Up/Down**: Move focus up/down (1 channel)
- **Arrow Left/Right**: Move focus left/right (1 time block)
- **PageUp/PageDown**: Jump 5 channels up/down
- **Home**: Jump to start of time range
- **End**: Jump to end of time range
- **Enter**: Select focused program (open details panel)

### Search
- **Arrow Up/Down**: Navigate results
- **Enter**: Jump to selected result
- **Escape**: Close search

## Integration Guide

### Step 1: Install Dependencies
```bash
npm install react-window
```

### Step 2: Copy Files to Your Project
Copy these files from `JapanIPTV-main` to `jptv-player/src`:

```
JapanIPTV-main/src/epg/EpgStore.ts
  → jptv-player/src/epg/EpgStore.ts

JapanIPTV-main/src/hooks/useEpgPreferences.ts
  → jptv-player/src/hooks/useEpgPreferences.ts

JapanIPTV-main/src/components/EpgGrid.tsx
JapanIPTV-main/src/components/EpgGrid.module.css
  → jptv-player/src/components/

JapanIPTV-main/src/components/EpgDetailsPanel.tsx
JapanIPTV-main/src/components/EpgDetailsPanel.module.css
  → jptv-player/src/components/

JapanIPTV-main/src/components/EpgSearch.tsx
JapanIPTV-main/src/components/EpgSearch.module.css
  → jptv-player/src/components/

JapanIPTV-main/src/components/EpgFilters.tsx
JapanIPTV-main/src/components/EpgFilters.module.css
  → jptv-player/src/components/

JapanIPTV-main/src/components/EpgScreen.tsx
JapanIPTV-main/src/components/EpgScreen.module.css
  → jptv-player/src/components/
```

### Step 3: Update ProfileData Type
The ProfileData type in `jptv-player/src/types/profile.ts` should already be updated with the 8 EPG preference fields (from the conversation history). If not, add them:

```typescript
export interface ProfileData {
  // ...existing fields
  
  epgEnabled?: boolean;
  epgTimeSpanHours?: number;
  epgTimeBlockMinutes?: number;
  epgChannelOrder?: 'playlist' | 'alphabetical' | 'favorites-first';
  epgHiddenCategories?: string[];
  epgHiddenChannels?: string[];
  epgFavoritesOnly?: boolean;
  lastEpgViewState?: {
    scrollX?: number;
    scrollY?: number;
    focusedChannelId?: string;
    focusedTimeMs?: number;
  };
}
```

### Step 4: Integrate into App.tsx

#### 4.1 Import EPG Components
Add to imports at top of `App.tsx`:

```typescript
import { EpgScreen } from './components/EpgScreen';
import { getEpgStore } from './epg/EpgStore';
```

#### 4.2 Initialize EPG Store
Add after `const playerAdapter = new VlcPlayerAdapter();`:

```typescript
const epgStore = getEpgStore();
```

#### 4.3 Add EPG State
Add to state declarations in `App` function:

```typescript
const [showEpgPro, setShowEpgPro] = useState(false);
```

#### 4.4 Load EPG Data
Add effect to load EPG data from your existing XMLTV parser (modify to match your implementation):

```typescript
// Load EPG data into EpgStore
useEffect(() => {
  if (!epgLoading && epgChannels.size > 0) {
    // Map your existing EPG data to EpgStore
    epgChannels.forEach((channelData, channelId) => {
      const programs = channelData.programs.map(program => ({
        title: program.title,
        start: program.start,
        end: program.end,
        description: program.description || '',
        category: program.category || '',
      }));
      epgStore.setChannelPrograms(channelId, programs);
    });
    console.log('[EPG Pro] Loaded data for', epgChannels.size, 'channels');
  }
}, [epgLoading, epgChannels, epgStore]);
```

#### 4.5 Add Keyboard Shortcut
Update your `handleKeyDown` function in the keyboard event listener:

```typescript
// Replace the existing 'g' or 'G' key handler:
if (e.key === 'g' || e.key === 'G') {
  setShowEpgPro(prev => !prev);  // Changed from setShowFullGuide
  return;
}
```

#### 4.6 Add Channel Tuning Handler
Add handler for tuning to a channel from EPG:

```typescript
const handleEpgTuneChannel = useCallback(async (channelId: string) => {
  const channel = activeChannels.find(ch => String(ch.id) === channelId);
  if (channel) {
    const channelIndex = activeChannels.indexOf(channel);
    setChannelIndex(channelIndex);
    setSelectedChannel(channel);
    
    // Save to history
    saveLastChannel(channel, channelIndex, updateSetting);
    addToHistory(channelId);
    
    // Play channel
    clearError();
    updateState('buffering', channel.name);
    
    const playResult = await playChannelWithFallback(channel);
    if (playResult.success) {
      audioNormalization.switchChannel(channelId).catch(err => {
        console.warn('[AudioNormalization] Failed to switch channel:', err);
      });
      
      setFocusArea('player');
      setShowInfo(true);
      setTimeout(() => setShowInfo(false), 3000);
    } else {
      updateState('error', channel.name, playResult.error || 'All URLs failed');
      setTimeout(() => clearError(), 5000);
    }
  }
}, [activeChannels, updateSetting, addToHistory, playChannelWithFallback, updateState, clearError, audioNormalization]);
```

#### 4.7 Add EPG Screen to Render
Add before the closing `</div>` in the return statement:

```typescript
return (
  <div className={styles.app}>
    {/* ...existing components */}
    
    {/* EPG Pro Screen */}
    <EpgScreen
      profileSession={profileSession}
      channels={activeChannels.map(ch => ({
        id: String(ch.id),
        name: ch.name,
        logo: ch.logo,
        category: ch.category,
        isFavorite: settings.favorites?.includes(
          typeof ch.id === 'string' ? parseInt(ch.id, 16) || 0 : ch.id
        ),
      }))}
      epgStore={epgStore}
      onTuneChannel={handleEpgTuneChannel}
      onClose={() => setShowEpgPro(false)}
      isOpen={showEpgPro}
    />
  </div>
);
```

## Performance Optimizations

### Virtualization
The EPG grid uses `react-window` to render only visible rows, allowing smooth performance with 200+ channels:
- **Memory**: Only ~20 rows rendered at once (vs. 200+)
- **CPU**: Minimal rerender on scroll
- **GPU**: Hardware-accelerated scrolling

### Indexing
The EpgStore uses multiple indexing strategies:
- **Channel Index**: Map<string, ChannelPrograms> for O(1) lookups
- **Binary Search**: O(log n) for time-based queries
- **Search Index**: Token-based inverted index for fast text search

### Memoization
Components use React.useMemo and useCallback to prevent unnecessary rerenders:
- Program blocks calculated once per time span change
- Filtered channels memoized
- Event handlers wrapped in useCallback

## Data Flow

```
XMLTV Parser → EpgStore (indexing)
                  ↓
              EpgGrid (virtualized rendering)
                  ↓
           User interaction (keyboard/click)
                  ↓
          EpgDetailsPanel (program info)
                  ↓
       onWatch callback → App.tsx (tune channel)
```

## Troubleshooting

### "Programs not showing in grid"
- Check that EPG data is loaded into EpgStore via `setChannelPrograms()`
- Verify channel IDs match between playlist and EPG data
- Check console for EPG load messages

### "Search not finding programs"
- Ensure programs have `title`, `description`, and `category` fields
- Check that search index is built (happens automatically on first search)
- Try broader search terms

### "Scroll position not restored"
- Verify `lastEpgViewState` is being saved to profile data
- Check that `saveViewState()` is called on EPG close
- Ensure profile data is persisting to disk

### "Slow performance with many channels"
- Verify virtualization is working (should render ~20 rows)
- Check time span isn't too large (try 24h instead of 72h)
- Reduce time block minutes to decrease program count

## Future Enhancements

Potential additions to EPG Pro:

1. **Reminder System**
   - Desktop notifications for upcoming programs
   - Reminder list management
   - Auto-tune when program starts

2. **Recording Integration**
   - Record from EPG (right-click menu)
   - Schedule future recordings
   - Recording status in grid

3. **Program Recommendations**
   - Based on viewing history
   - Similar program suggestions
   - Favorite category tracking

4. **Multi-Grid View**
   - Split screen for multiple time ranges
   - Compare channels side-by-side
   - Picture-in-picture preview

5. **EPG Data Management**
   - Auto-refresh from internet sources
   - Manual EPG edit/correction
   - Import/export EPG data

6. **Advanced Filters**
   - Time of day filters (morning/prime/late)
   - Duration filters (movies vs. shorts)
   - Rating filters (parental)
   - Genre-based recommendations

## Credits

EPG Pro System designed for high-performance IPTV applications with 200+ channels and 48-72 hour program data.

Built with:
- React + TypeScript
- react-window (virtualization)
- Electron (desktop integration)
- Japanese UTF-8 support

---

**End of EPG_PRO.md**
