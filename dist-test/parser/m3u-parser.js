"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseM3U = parseM3U;
exports.getCategories = getCategories;
exports.filterByCategory = filterByCategory;
exports.isValidM3U = isValidM3U;
const crypto = __importStar(require("crypto"));
/**
 * Parse M3U/M3U8 playlist content into structured channel data
 */
function parseM3U(content, debug = false) {
    try {
        const lines = content.split(/\r?\n/).map(line => line.trim());
        if (lines.length === 0 || !lines[0].startsWith('#EXTM3U')) {
            return {
                success: false,
                error: 'Invalid M3U file: Missing #EXTM3U header'
            };
        }
        const channels = [];
        const skippedReasons = [];
        let skippedCount = 0;
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('#EXTINF:')) {
                const nextLine = lines[i + 1];
                // Check if next line is a valid URL (not empty, not a comment)
                if (!nextLine || nextLine.startsWith('#') || nextLine.trim() === '') {
                    skippedCount++;
                    skippedReasons.push({
                        line: i + 1,
                        reason: 'Missing or invalid URL after EXTINF',
                        content: line.substring(0, 60)
                    });
                    continue;
                }
                const channel = parseExtinf(line, nextLine);
                if (channel) {
                    channels.push(channel);
                }
                else {
                    skippedCount++;
                    skippedReasons.push({
                        line: i + 1,
                        reason: 'Failed to extract channel name',
                        content: line.substring(0, 60)
                    });
                }
                i++; // Skip the URL line as we've already processed it
            }
        }
        if (debug && skippedReasons.length > 0) {
            console.log(`[M3U Parser] Skipped ${skippedCount} entries:`);
            skippedReasons.forEach(({ line, reason, content }) => {
                console.log(`  Line ${line}: ${reason}`);
                if (content)
                    console.log(`    Content: ${content}...`);
            });
        }
        const categories = buildCategories(channels);
        return {
            success: true,
            data: { channels, categories },
            skippedCount,
            skipped: skippedReasons.length > 0 ? skippedReasons : undefined
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown parsing error'
        };
    }
}
/**
 * Parse a single EXTINF line into a Channel object
 * Handles multiple formats:
 * - Full: #EXTINF:-1 tvg-id="123" tvg-name="Name" tvg-logo="url" group-title="Group",Display Name
 * - Minimal: #EXTINF:-1,Channel Name
 * - No attributes: #EXTINF:123,Channel Name
 */
function parseExtinf(extinfLine, urlLine) {
    try {
        const url = urlLine.trim();
        if (!url || url.startsWith('#')) {
            return null;
        }
        // Extract content after #EXTINF:
        // Format: #EXTINF:duration [attributes],name
        const match = extinfLine.match(/#EXTINF:([^,]*),(.*)$/);
        if (!match) {
            return null;
        }
        const beforeComma = match[1]; // duration and attributes
        const afterComma = match[2].trim(); // display name
        // Parse attributes (may be empty)
        const attributes = parseAttributes(beforeComma);
        // Determine channel name: prefer text after comma, fallback to tvg-name
        const name = afterComma || attributes['tvg-name'] || 'Unknown Channel';
        if (!name || name === 'Unknown Channel') {
            return null; // Can't determine channel name
        }
        // Extract optional attributes with sensible defaults
        const tvgId = attributes['tvg-id'] || '';
        const id = tvgId || generateId(name, url);
        const group = attributes['group-title'] || 'Uncategorized';
        const logo = attributes['tvg-logo'] || '';
        const tvgName = attributes['tvg-name'];
        return {
            id,
            name,
            group,
            logo,
            url,
            tvgName,
            metadata: attributes
        };
    }
    catch (error) {
        // Silent fail - invalid entry
        return null;
    }
}
/**
 * Parse attribute string into key-value pairs
 * Handles: tvg-id="123" tvg-name="Name" group-title="Group"
 * Also handles: no attributes at all
 */
function parseAttributes(attrStr) {
    const attributes = {};
    if (!attrStr || !attrStr.trim()) {
        return attributes;
    }
    // Match key="value" or key='value' patterns
    const attrRegex = /(\S+?)=["']([^"']*?)["']/g;
    let match;
    while ((match = attrRegex.exec(attrStr)) !== null) {
        const key = match[1];
        const value = match[2];
        attributes[key] = value;
    }
    return attributes;
}
/**
 * Generate a unique ID from channel name and URL
 */
function generateId(name, url) {
    const hash = crypto.createHash('md5');
    hash.update(`${name}:${url}`);
    return hash.digest('hex').substring(0, 8);
}
/**
 * Build category map from channels
 */
function buildCategories(channels) {
    const categories = new Map();
    for (const channel of channels) {
        const group = channel.group || 'Uncategorized';
        if (!categories.has(group)) {
            categories.set(group, []);
        }
        categories.get(group).push(channel);
    }
    // Sort channels within each category by name
    for (const [_, channelList] of categories) {
        channelList.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    }
    return categories;
}
/**
 * Get all unique categories from channels
 */
function getCategories(channels) {
    const categories = new Set();
    for (const channel of channels) {
        categories.add(channel.group);
    }
    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'ja'));
}
/**
 * Filter channels by category
 */
function filterByCategory(channels, category) {
    if (!category || category === 'すべて' || category === 'All') {
        return channels;
    }
    return channels.filter(c => c.group === category);
}
/**
 * Validate M3U content
 */
function isValidM3U(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }
    const lines = content.trim().split(/\r?\n/);
    return lines.length > 0 && lines[0].trim().startsWith('#EXTM3U');
}
