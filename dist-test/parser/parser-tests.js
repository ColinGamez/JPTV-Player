"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runParserTests = runParserTests;
const m3u_parser_1 = require("./m3u-parser");
// Test M3U content with Japanese characters and various formats
const testM3U = `#EXTM3U
#EXTINF:-1 tvg-id="1" tvg-name="NHK総合" tvg-logo="https://example.com/nhk.png" group-title="地上波",NHK総合
https://stream.example.com/nhk.m3u8
#EXTINF:-1 tvg-id="2" tvg-name="テレビ朝日" tvg-logo="https://example.com/asahi.png" group-title="地上波",テレビ朝日
https://stream.example.com/asahi.m3u8
#EXTINF:-1 tvg-id="5" tvg-name="BS11" tvg-logo="https://example.com/bs11.png" group-title="BS放送",BS11
https://stream.example.com/bs11.m3u8
#EXTINF:-1 tvg-name="スカイA" group-title="CS放送",スカイA
https://stream.example.com/sky-a.m3u8
#EXTINF:-1,Minimal Format Channel
https://stream.example.com/minimal.m3u8
#EXTINF:-1,No Group Channel
https://stream.example.com/no-group.m3u8
#EXTINF:123,Duration Only Channel
https://stream.example.com/duration.m3u8
#EXTINF:-1,Malformed Entry Without URL
#EXTINF:-1 tvg-id="999" tvg-name="Valid" group-title="Test",Valid Channel
https://stream.example.com/valid.m3u8
`;
// Large real-world style playlist
const largePlaylist = generateLargePlaylist(200);
function generateLargePlaylist(count) {
    let content = '#EXTM3U\n';
    const categories = ['地上波', 'BS', 'CS', 'スポーツ', '映画', 'ニュース', 'アニメ', '音楽'];
    const formats = [
        // Full attributes
        (i, cat) => `#EXTINF:-1 tvg-id="${i}" tvg-name="チャンネル${i}" tvg-logo="https://example.com/logo${i}.png" group-title="${cat}",チャンネル${i}\nhttps://stream.example.com/ch${i}.m3u8`,
        // No logo
        (i, cat) => `#EXTINF:-1 tvg-id="${i}" tvg-name="チャンネル${i}" group-title="${cat}",チャンネル${i}\nhttps://stream.example.com/ch${i}.m3u8`,
        // Minimal with category
        (i, cat) => `#EXTINF:-1 group-title="${cat}",チャンネル${i}\nhttps://stream.example.com/ch${i}.m3u8`,
        // Minimal only
        (i, cat) => `#EXTINF:-1,チャンネル${i}\nhttps://stream.example.com/ch${i}.m3u8`,
    ];
    for (let i = 1; i <= count; i++) {
        const cat = categories[i % categories.length];
        const format = formats[i % formats.length];
        content += format(i, cat) + '\n';
    }
    return content;
}
/**
 * Run parser tests
 */
function runParserTests() {
    console.log('=== M3U Parser Tests ===\n');
    // Test 1: Validate M3U
    console.log('Test 1: isValidM3U');
    console.log('Valid M3U:', (0, m3u_parser_1.isValidM3U)(testM3U));
    console.log('Invalid M3U:', (0, m3u_parser_1.isValidM3U)('not an m3u file'));
    console.log('Empty string:', (0, m3u_parser_1.isValidM3U)(''));
    console.log('');
    // Test 2: Parse M3U with various formats
    console.log('Test 2: parseM3U (Various Formats)');
    const result = (0, m3u_parser_1.parseM3U)(testM3U, true); // Enable debug
    console.log('Success:', result.success);
    console.log('Channels found:', result.data?.channels.length);
    console.log('Skipped entries:', result.skippedCount);
    console.log('Categories:', result.data?.categories.size);
    console.log('');
    if (result.data) {
        // Test 3: Display channels
        console.log('Test 3: Channel Details');
        result.data.channels.forEach((ch, i) => {
            const logoStatus = ch.logo ? '✓' : '✗';
            const idSource = ch.metadata?.['tvg-id'] ? 'tvg-id' : 'hash';
            console.log(`  ${i + 1}. ${ch.name} (${ch.group}) [logo:${logoStatus}] [id:${idSource}]`);
        });
        console.log('');
        // Test 4: Categories
        console.log('Test 4: Categories');
        const categories = (0, m3u_parser_1.getCategories)(result.data.channels);
        categories.forEach(cat => {
            const count = (0, m3u_parser_1.filterByCategory)(result.data.channels, cat).length;
            console.log(`  ${cat}: ${count} channels`);
        });
        console.log('');
        // Test 5: Minimal format channels
        console.log('Test 5: Minimal Format Support');
        const minimal = result.data.channels.find(c => c.name === 'Minimal Format Channel');
        console.log('  Found minimal format:', minimal?.name);
        console.log('  Has default group:', minimal?.group === 'Uncategorized');
        console.log('  Has generated ID:', minimal?.id.length === 8);
        console.log('');
        // Test 6: Japanese text encoding
        console.log('Test 6: UTF-8 Japanese Support');
        const japanese = result.data.channels.find(c => c.name.includes('テレビ朝日'));
        console.log('  Found channel:', japanese?.name);
        console.log('  Group:', japanese?.group);
        console.log('');
    }
    // Test 7: Malformed M3U
    console.log('Test 7: Malformed Input');
    const badResult = (0, m3u_parser_1.parseM3U)('Invalid content');
    console.log('  Success:', badResult.success);
    console.log('  Error:', badResult.error);
    console.log('');
    // Test 8: Large playlist
    console.log('Test 8: Large Playlist Performance');
    const startTime = Date.now();
    const largeResult = (0, m3u_parser_1.parseM3U)(largePlaylist, false);
    const endTime = Date.now();
    console.log('  Success:', largeResult.success);
    console.log('  Channels:', largeResult.data?.channels.length);
    console.log('  Categories:', largeResult.data?.categories.size);
    console.log('  Parse time:', endTime - startTime, 'ms');
    console.log('  Skipped:', largeResult.skippedCount);
    console.log('');
    // Test 9: Edge cases
    console.log('Test 9: Edge Cases');
    const edgeCases = `#EXTM3U
#EXTINF:-1,
https://empty-name.m3u8
#EXTINF:-1 tvg-name="OnlyTvgName",
https://only-tvg-name.m3u8
#EXTINF:-1,Name With 日本語 Characters
https://japanese-in-name.m3u8
`;
    const edgeResult = (0, m3u_parser_1.parseM3U)(edgeCases, true);
    console.log('  Parsed:', edgeResult.data?.channels.length, 'channels');
    console.log('  Skipped:', edgeResult.skippedCount, 'entries');
    if (edgeResult.data) {
        edgeResult.data.channels.forEach(ch => {
            console.log(`    - ${ch.name} [${ch.id}]`);
        });
    }
    console.log('');
    console.log('=== Tests Complete ===');
}
// Run tests if executed directly
if (require.main === module) {
    runParserTests();
}
