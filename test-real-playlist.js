import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseM3U } from './src/parser/m3u-parser.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
console.log('=== Testing Real Playlist (jptv.m3u8) ===\n');
const playlistPath = join(__dirname, '..', 'JapanIPTV-main', 'jptv.m3u8');
const content = readFileSync(playlistPath, 'utf-8');
console.log(`File size: ${content.length} bytes`);
console.log(`Lines: ${content.split('\n').length}\n`);
const result = parseM3U(content, true);
console.log(`\n=== Results ===`);
console.log(`Success: ${result.success}`);
console.log(`Channels parsed: ${result.data?.channels.length || 0}`);
console.log(`Skipped: ${result.skipped?.length || 0}`);
console.log(`Categories: ${result.data?.categories.size || 0}`);
if (result.data) {
    console.log(`\n=== Category Breakdown ===`);
    const sortedCategories = Array.from(result.data.categories.entries())
        .sort((a, b) => (b[1]?.length || 0) - (a[1]?.length || 0));
    sortedCategories.forEach(([cat, channels]) => {
        console.log(`  ${cat}: ${channels.length} channels`);
    });
    console.log(`\n=== Sample Channels (first 10) ===`);
    result.data.channels.slice(0, 10).forEach((ch, idx) => {
        const logo = ch.logo ? '✓' : '✗';
        const idType = ch.id.length === 8 ? 'hash' : 'tvg-id';
        console.log(`  ${idx + 1}. ${ch.name} (${ch.group}) [logo:${logo}] [id:${idType}]`);
    });
}
if (result.skipped && result.skipped.length > 0) {
    console.log(`\n=== Skipped Entries (showing first 10) ===`);
    result.skipped.slice(0, 10).forEach(skip => {
        console.log(`  Line ${skip.line}: ${skip.reason}`);
        if (skip.content)
            console.log(`    "${skip.content}"`);
    });
    if (result.skipped.length > 10) {
        console.log(`  ... and ${result.skipped.length - 10} more`);
    }
}
