# M3U/M3U8 Parser Documentation

## Overview

Pure TypeScript M3U/M3U8 playlist parser for Japanese IPTV channels. No external dependencies, graceful error handling, full UTF-8 support.

## Features

- ✅ Parse EXTINF entries with attributes
- ✅ Extract tvg-id, tvg-name, tvg-logo, group-title
- ✅ Generate fallback IDs from channel name + URL hash
- ✅ UTF-8 Japanese text support
- ✅ Skip malformed entries without crashing
- ✅ Build category maps automatically
- ✅ Unit testable pure functions
- ✅ IPC integration with Electron

## API

### `parseM3U(content: string): ParserResult`

Main parsing function. Takes M3U/M3U8 content string, returns structured result.

**Returns:**
```typescript
{
  success: boolean;
  data?: {
    channels: Channel[];
    categories: Map<string, Channel[]>;
  };
  error?: string;
  skippedCount?: number;
}
```

**Example:**
```typescript
import { parseM3U } from './parser/m3u-parser';

const content = fs.readFileSync('playlist.m3u8', 'utf-8');
const result = parseM3U(content);

if (result.success && result.data) {
  console.log(`Loaded ${result.data.channels.length} channels`);
  console.log(`Categories: ${result.data.categories.size}`);
}
```

### `isValidM3U(content: string): boolean`

Quickly validate M3U format before parsing.

```typescript
if (isValidM3U(content)) {
  const result = parseM3U(content);
}
```

### `getCategories(channels: Channel[]): string[]`

Extract sorted unique category names from channels.

```typescript
const categories = getCategories(result.data.channels);
// ["BS", "CS", "地上波"]
```

### `filterByCategory(channels: Channel[], category: string): Channel[]`

Filter channels by category. Returns all if category is 'すべて' or 'All'.

```typescript
const terrestrial = filterByCategory(channels, '地上波');
```

## Channel Model

```typescript
interface Channel {
  id: string;              // tvg-id or MD5 hash
  name: string;            // Display name
  group: string;           // Category (group-title)
  logo: string;            // Logo URL (tvg-logo)
  url: string;             // Stream URL
  tvgName?: string;        // tvg-name attribute
  metadata?: Record<string, string>;  // All attributes
}
```

## M3U Format Support

Parses standard EXTINF format:

```
#EXTINF:-1 tvg-id="123" tvg-name="Name" tvg-logo="http://logo.png" group-title="Category",Display Name
http://stream-url.m3u8
```

### Supported Attributes

- `tvg-id` - Channel ID
- `tvg-name` - Alternative name
- `tvg-logo` - Logo URL
- `group-title` - Category/Group
- All other attributes preserved in `metadata`

### Fallback Behavior

- **No tvg-id:** Generates MD5 hash from name + URL
- **No name:** Uses tvg-name or "Unknown"
- **No group:** Sets to "Uncategorized"
- **Empty logo:** Empty string (handled by UI)
- **Missing URL:** Entry skipped

## IPC Integration

### Main Process (electron/main.ts)

```typescript
import { parseM3U } from '../src/parser/m3u-parser';

ipcMain.handle('dialog:openPlaylist', async () => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parseResult = parseM3U(content);
  
  // Convert Map to object for IPC
  const categoriesObj = {};
  for (const [key, value] of parseResult.data.categories) {
    categoriesObj[key] = value;
  }
  
  return { path, content, parseResult };
});
```

### Renderer Process (React hooks)

```typescript
import { usePlaylist } from './hooks/usePlaylist';

const { channels, categories, openPlaylist } = usePlaylist();

// Open file dialog
await openPlaylist();

// Use parsed data
console.log(`Loaded ${channels.length} channels`);
```

## Error Handling

Parser never throws, always returns `ParserResult`:

```typescript
const result = parseM3U(content);

if (!result.success) {
  console.error('Parse failed:', result.error);
  // Fallback to mock data or show error
}

if (result.skippedCount > 0) {
  console.warn(`Skipped ${result.skippedCount} malformed entries`);
}
```

## Testing

Run unit tests:

```bash
npm run test:parser
```

Tests cover:
- Valid M3U parsing
- Malformed entry handling
- UTF-8 Japanese text
- Category building
- ID generation
- Attribute parsing

## Performance

- **Parser:** O(n) where n = number of lines
- **Category building:** O(n * log n) due to sorting
- **Memory:** ~1KB per channel

Typical 1000-channel playlist:
- Parse time: ~10ms
- Memory: ~1MB

## Usage in App

1. User presses `O` key
2. Native file dialog opens
3. User selects .m3u8 file
4. IPC sends path to main process
5. Main reads file, calls parser
6. Parsed data returned to renderer
7. UI updates with real channels
8. Mock data replaced

## Examples

See [sample-playlist.m3u8](sample-playlist.m3u8) for example file.

See [src/parser/parser-tests.ts](src/parser/parser-tests.ts) for usage examples.
