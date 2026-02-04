# Documentation Structure Recommendation

## Suggested `/docs` Folder

Create the following structure:

```
docs/
├── USER_GUIDE.md          # Complete usage instructions
├── TV_BOX_MODE.md         # Explanation of TV box behavior (already exists)
├── FAQ.md                 # Common questions and troubleshooting
├── LEGAL.md               # Extended legal notices
└── images/                # Screenshots for documentation
    ├── main-screen.png
    ├── channel-list.png
    └── epg-view.png
```

---

## File Descriptions

### `USER_GUIDE.md`
**Purpose**: Comprehensive walkthrough of all app features.

**Sections**:
1. Installation
2. First Launch
3. Loading Playlists
4. Loading EPG Data
5. Profile System
6. Keyboard Controls Reference
7. Favorites Management
8. Parental Controls
9. Settings & Preferences
10. Troubleshooting

**Tone**: Step-by-step, beginner-friendly, with screenshots.

---

### `TV_BOX_MODE.md`
**Purpose**: Explain the TV box paradigm (already exists, can be moved to /docs).

**Sections**:
- What is TV Box Mode?
- Auto-Login & Auto-Play
- UI Auto-Hide Behavior
- Fullscreen Management
- Profile Persistence
- Keyboard-Only Control

**Tone**: Educational, explains design decisions.

---

### `FAQ.md`
**Purpose**: Quick answers to common questions.

**Sections**:
1. **General**
   - What is JPTV Player?
   - Is it free?
   - Does it work on Mac/Linux?
   - Where does it store settings?

2. **Playlists**
   - Where do I get playlists?
   - What formats are supported?
   - Can I use multiple playlists?
   - My playlist isn't loading, what's wrong?

3. **EPG (Program Guide)**
   - What is EPG/XMLTV?
   - Where do I get EPG files?
   - How often should I update EPG data?
   - EPG times are wrong, how do I fix?

4. **Playback**
   - Stream won't play, what should I do?
   - How do I fix buffering issues?
   - Can I record streams?
   - Audio is too loud/quiet between channels

5. **Legal**
   - Is using IPTV legal?
   - Am I responsible for what I stream?
   - What about free IPTV lists online?

6. **Troubleshooting**
   - App won't start
   - Black screen on launch
   - Channels not loading
   - EPG not showing
   - Performance issues

**Tone**: Direct, Q&A format, solution-focused.

---

### `LEGAL.md`
**Purpose**: Extended legal disclaimers (optional, can be in FAQ instead).

**Sections**:
- Software License (MIT)
- IPTV Content Disclaimer
- User Responsibility
- Copyright Notice
- Liability Limitations
- Regional Legal Considerations

**Tone**: Formal, protective, clear.

---

## Visual Assets

### Recommended Screenshots

Add to `docs/images/`:

1. **Main Screen** – Full UI showing channel list, category rail, player
2. **Channel List** – Close-up of channel selection
3. **EPG View** – Program guide with now/next info
4. **Full EPG Grid** – Multi-channel timeline view
5. **Profile Select** – Profile management screen
6. **Info Overlay** – Channel info display

**Format**: PNG, 1920x1080 resolution, compressed for web.

---

## Integration with README

Update main README.md to link to docs:

```markdown
## 📖 Documentation

- **[User Guide](docs/USER_GUIDE.md)** – Complete usage instructions
- **[TV Box Mode Explained](docs/TV_BOX_MODE.md)** – Auto-play, profiles, UI behavior
- **[FAQ](docs/FAQ.md)** – Common questions and troubleshooting
```

---

## Minimal vs. Complete Strategy

### Minimal (Ship v1.0.0)
- USER_GUIDE.md (basic)
- FAQ.md (common questions)
- Move existing TV_BOX_MODE.md to /docs

### Complete (Post-Launch)
- Add LEGAL.md
- Add screenshots to docs/images/
- Expand USER_GUIDE with step-by-step tutorials
- Add video walkthrough links

---

## Sample FAQ Entries

### Is using IPTV legal?

**Short Answer**: It depends on the content and your location.

**Details**:
- IPTV technology itself is legal
- Streaming copyrighted content without authorization is illegal in most countries
- Using IPTV services you pay for (e.g., YouTube TV, Sling) is legal
- Using free "pirate" streams is illegal
- **Always verify the legality of your content source**

### Where do I get playlists?

**Legal Sources**:
- Your paid IPTV subscription provider
- Self-hosted streams (your own cameras, media server)
- Official broadcaster apps that provide M3U exports
- Community lists of **legal**, free-to-air channels

**Warning**: Many "free IPTV" lists online contain pirated content. Using these may be illegal in your jurisdiction.

### App won't start / black screen

**Troubleshooting Steps**:
1. Check Windows version (requires Windows 10/11 64-bit)
2. Ensure VLC components installed (included in installer)
3. Run as Administrator (right-click → Run as administrator)
4. Check antivirus isn't blocking the app
5. Reinstall the application
6. Check logs at: `%APPDATA%\jptv-player\logs`

### My stream is buffering constantly

**Common Fixes**:
1. Check your internet connection speed (test at speedtest.net)
2. Try a different channel to isolate the issue
3. Close other bandwidth-heavy applications
4. If using Wi-Fi, try wired Ethernet
5. Contact your IPTV provider (may be server-side issue)
6. Try reducing stream quality (if provider offers multiple URLs)

---

## Maintenance Plan

- **Update FAQ** after each major release with new questions
- **Refresh screenshots** when UI changes significantly
- **Add troubleshooting entries** based on GitHub Issues
- **Expand USER_GUIDE** based on user feedback

---

**Goal**: Make docs comprehensive enough that users rarely need to contact support.
