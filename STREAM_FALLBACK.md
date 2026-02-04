# Stream Fallback System

## Overview

Automatic fallback stream URLs allow channels to have multiple backup URLs. When playback fails, the system automatically tries the next URL without user intervention. Errors are only shown after all URLs have been exhausted.

## Features

- **Multiple URLs per channel**: Channels can have an array of fallback URLs
- **Automatic retry**: Failed URLs are automatically skipped
- **Last successful URL tracking**: Remembers which URL worked last time
- **Transparent fallback**: Users don't see individual URL failures
- **Smart retry logic**: Tries each URL once before moving to next

## Architecture

### Data Layer

**File**: `src/types/channel.ts`

```typescript
export interface Channel {
  url: string;              // Primary URL (backwards compatible)
  urls: string[];           // All URLs (fallback array)
  lastSuccessfulUrl?: string; // Last URL that worked
  // ... other fields
}
```

### Main Process

**File**: `electron/stream-fallback.ts`

`StreamFallbackManager` class manages fallback state:
- Tracks current URL index per channel
- Remembers failed URLs
- Provides next URL on failure
- Stores last successful URL

**File**: `electron/main.ts`

New IPC handlers:
- `player:playWithFallback(channelId, urls, lastSuccessfulUrl)` - Start with fallback
- `player:retryFallback(channelId)` - Try next URL
- `player:getLastSuccessfulUrl(channelId)` - Get last working URL

### Renderer Process

**File**: `src/hooks/useChannelFallback.ts`

Hook for managing fallback in React:
- `playChannelWithFallback(channel)` - Play with automatic fallback
- `retryCurrentChannel(channelId)` - Manual retry
- `getLastSuccessfulUrl(channelId)` - Query last successful URL

**File**: `src/App.tsx`

Integration points:
- Numeric channel selection
- Enter key channel selection
- Both use `playChannelWithFallback()`

## Flow

### Initial Playback

1. User selects channel with multiple URLs
2. App calls `playChannelWithFallback(channel)`
3. Main process initializes `StreamFallbackManager` with:
   - All URLs from channel
   - Last successful URL (if available)
4. Tries last successful URL first (or first in array)
5. On success: marks URL as successful, playback starts
6. On failure: automatically tries next URL

### Automatic Fallback

1. URL fails to play
2. `StreamFallbackManager.markFailureAndGetNext()` called
3. Manager returns next URL in array
4. Main process stops current attempt
5. Tries next URL automatically
6. Repeats until success or all URLs exhausted

### Error Reporting

- **Individual URL failure**: Silent, moves to next
- **All URLs failed**: Error shown to user: "All URLs failed"
- **No retry spam**: Each URL tried once per playback attempt

## Configuration

```typescript
// StreamFallbackManager settings
maxRetriesPerUrl = 1;  // Retry each URL once before moving to next
```

## Usage Examples

### Single URL (Backward Compatible)

```typescript
const channel = {
  name: "NHK",
  url: "http://stream1.example.com",
  urls: ["http://stream1.example.com"]  // Auto-populated
};
```

### Multiple URLs

```typescript
const channel = {
  name: "NHK",
  url: "http://stream1.example.com",
  urls: [
    "http://stream1.example.com",  // Primary
    "http://backup.example.com",   // Backup 1
    "http://cdn.example.com"       // Backup 2
  ]
};
```

### With Last Successful URL

```typescript
const channel = {
  name: "NHK",
  url: "http://stream1.example.com",
  urls: [
    "http://stream1.example.com",
    "http://backup.example.com",
    "http://cdn.example.com"
  ],
  lastSuccessfulUrl: "http://backup.example.com"  // Starts here
};
```

## Parser Integration

**File**: `src/parser/m3u-parser.ts`

Currently initializes `urls` with single URL:

```typescript
return {
  url,
  urls: [url],  // Single URL array
  // ...
};
```

### Future Enhancement: Multiple URLs in M3U

To support multiple URLs per channel in M3U files, use comments or extended attributes:

```m3u
#EXTINF:-1 tvg-id="nhk" tvg-name="NHK",NHK総合
http://stream1.example.com
#EXTURL:http://backup.example.com
#EXTURL:http://cdn.example.com
```

Or group consecutive URLs:

```m3u
#EXTINF:-1 tvg-id="nhk",NHK総合
http://stream1.example.com
http://backup.example.com
http://cdn.example.com

#EXTINF:-1 tvg-id="tbs",TBS
http://tbs1.example.com
```

## State Management

### Per-Channel State

```typescript
{
  channelId: "nhk-general",
  urls: ["url1", "url2", "url3"],
  currentIndex: 1,              // Currently trying url2
  lastSuccessfulUrl: "url2",    // Last time url2 worked
  failedUrls: Set(["url1"]),    // url1 failed this session
  retryCount: 0                 // Retry attempts on current URL
}
```

### State Lifecycle

1. **Initialize**: User plays channel, state created
2. **Success**: Current URL marked successful, state persists
3. **Failure**: Move to next URL, update failedUrls
4. **Reset**: New playback attempt resets to last successful
5. **Clear**: Channel change clears old state

## Logging

All fallback operations logged to `%APPDATA%/jptv-player/logs/vlc-player.log`:

```
[Fallback] Fallback initialized | channelId=nhk | urlCount=3 | startIndex=0
[Fallback] URL marked failed | channelId=nhk | url=http://... | index=0
[Fallback] Trying next URL | channelId=nhk | url=http://... | index=1
[Fallback] URL marked successful | channelId=nhk | url=http://... | index=1
```

## Performance

- **Memory**: ~200 bytes per channel (state tracking)
- **CPU**: Negligible (state lookups)
- **Network**: No additional overhead (same number of attempts)

## Limitations

1. **URL identification**: Uses full URL as channel ID
2. **No parallel tries**: URLs tried sequentially, not in parallel
3. **Session-based**: Failed URLs tracked per session only
4. **No health-based sorting**: Doesn't prioritize URLs by health score

## Future Enhancements

1. **Persistent failure tracking**: Remember failed URLs across sessions
2. **Health-based ordering**: Sort URLs by health score
3. **Parallel probing**: Try multiple URLs simultaneously
4. **Geographic routing**: Prefer URLs based on latency
5. **Load balancing**: Distribute load across available URLs
6. **URL validation**: Pre-validate URLs before playback

## API Reference

### Main Process

```typescript
// Initialize fallback for channel
initializeChannel(channelId: string, urls: string[], lastSuccessfulUrl?: string): void

// Get current URL to try
getCurrentUrl(channelId: string): string | null

// Mark success
markSuccess(channelId: string): void

// Mark failure and get next
markFailureAndGetNext(channelId: string): string | null

// Reset to beginning
reset(channelId: string): void

// Get statistics
getStats(channelId: string): { total, current, failed, hasMore }
```

### Renderer Process

```typescript
// Play with fallback
playChannelWithFallback(channel: Channel): Promise<PlaybackResult>

// Retry current channel
retryCurrentChannel(channelId: string): Promise<PlaybackResult>

// Get last successful URL
getLastSuccessfulUrl(channelId: string): Promise<string | null>
```

## Testing

### Test Single URL

```typescript
const channel = {
  name: "Test",
  url: "http://working.example.com",
  urls: ["http://working.example.com"]
};
// Should play normally
```

### Test Fallback

```typescript
const channel = {
  name: "Test",
  url: "http://broken.example.com",
  urls: [
    "http://broken.example.com",   // Will fail
    "http://working.example.com"   // Should succeed
  ]
};
// Should automatically switch to working URL
```

### Test All Failed

```typescript
const channel = {
  name: "Test",
  url: "http://broken1.example.com",
  urls: [
    "http://broken1.example.com",
    "http://broken2.example.com",
    "http://broken3.example.com"
  ]
};
// Should show error after trying all
```

## Troubleshooting

### Fallback not working

1. Check channel has `urls` array: `console.log(channel.urls)`
2. Verify multiple URLs: `channel.urls.length > 1`
3. Check logs: Look for "Fallback initialized" message
4. Ensure VLC and fallback manager initialized

### Always uses first URL

1. Check `lastSuccessfulUrl` is set correctly
2. Verify fallback state persistence
3. Look for "Trying next URL" in logs

### Infinite retry loop

1. Check `maxRetriesPerUrl` setting (default: 1)
2. Verify failure detection working
3. Look for "All URLs failed" message
