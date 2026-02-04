# GitHub Release Template

## Release Name Format
```
v[MAJOR].[MINOR].[PATCH] – [Release Type]
```

Examples:
- `v1.0.0 – TV Box Release`
- `v1.1.0 – EPG Feature Update`
- `v1.0.1 – Stability Hotfix`

---

## Release Description Template

```markdown
# JPTV Player v[VERSION] – [RELEASE NAME]

## 📥 Download

**Choose your installation method:**

- **Installer (Recommended)**: `JPTV-Player-Setup-[VERSION].exe` (45 MB)
  - Installs to Program Files
  - Creates Start Menu shortcut
  - Includes auto-updater

- **Portable**: `JPTV-Player-Portable-[VERSION].zip` (52 MB)
  - Extract and run (no installation)
  - Settings stored in app folder
  - Useful for USB drives

**System Requirements:** Windows 10/11 (64-bit), 4 GB RAM

---

## ✨ What's New in v[VERSION]

[List new features, improvements, and fixes]

### New Features
- 🎯 [Feature name] – [Brief description]
- 📺 [Feature name] – [Brief description]

### Improvements
- ⚡ [Performance improvement]
- 🎨 [UI enhancement]

### Bug Fixes
- 🐛 Fixed [specific issue]
- 🔧 Resolved [specific problem]

---

## 🚀 First-Time Setup

1. **Install the app** (or extract portable version)
2. **Launch JPTV Player** from Start Menu
3. **Load your playlist**: Press **O** and select your `.m3u` or `.m3u8` file
4. **Optional: Load EPG data**: Press **L** and select your XMLTV EPG file
5. **Start watching!** Use arrow keys to browse channels

---

## ⚖️ Legal Notice

This application is a media player only. It does **not** provide any content, streams, or playlists.

Users must supply their own **legal** M3U/M3U8 playlists. Streaming copyrighted content without authorization is illegal. Use responsibly.

---

## 📖 Documentation

- [User Guide](https://github.com/ColinGamez/JPTV-Player/blob/main/docs/USER_GUIDE.md)
- [TV Box Mode Explained](https://github.com/ColinGamez/JPTV-Player/blob/main/docs/TV_BOX_MODE.md)
- [FAQ](https://github.com/ColinGamez/JPTV-Player/blob/main/docs/FAQ.md)

---

## 🐛 Known Issues

[If any, list known bugs or limitations]

- [Issue description] – Workaround: [solution]

---

## 💖 Support Development

If you find JPTV Player useful, consider [sponsoring the project](https://github.com/sponsors/ColinGamez).

---

**Full Changelog**: https://github.com/ColinGamez/JPTV-Player/compare/v[PREVIOUS]...v[CURRENT]
```

---

## Asset Naming Convention

Upload these files to each release:

1. **Installer**:
   - Filename: `JPTV-Player-Setup-[VERSION].exe`
   - Example: `JPTV-Player-Setup-1.0.0.exe`

2. **Portable (Optional)**:
   - Filename: `JPTV-Player-Portable-[VERSION].zip`
   - Example: `JPTV-Player-Portable-1.0.0.zip`
   - Contains: Unpacked executable + all dependencies

3. **Checksums** (Optional but recommended):
   - Filename: `CHECKSUMS-[VERSION].txt`
   - Contains: SHA256 hashes for verification

---

## Example: v1.0.0 Release Notes

```markdown
# JPTV Player v1.0.0 – TV Box Release

## 📥 Download

- **Installer**: `JPTV-Player-Setup-1.0.0.exe` (45 MB)
- **Portable**: `JPTV-Player-Portable-1.0.0.zip` (52 MB)

---

## ✨ What's New

### First Stable Release!

JPTV Player brings a professional TV box experience to your Windows PC:

- 🎯 **TV Box Mode** – Auto-play, fullscreen, living room UX
- 📺 **M3U/M3U8 Support** – Load any standard IPTV playlist
- 📋 **EPG Integration** – XMLTV program guide support
- 👤 **Multi-Profile** – Separate favorites and settings per user
- ⌨️ **Keyboard Control** – Navigate with arrow keys or remote
- ⭐ **Favorites System** – Mark and filter your favorite channels
- 🎨 **Auto-Hide UI** – Clean playback experience
- 🔒 **Parental Controls** – Lock categories/channels with PIN
- 🎵 **Audio Normalization** – Consistent volume across channels

---

## 🚀 First-Time Setup

1. Run `JPTV-Player-Setup-1.0.0.exe`
2. Launch from Start Menu
3. Press **O** to load your M3U playlist
4. Press **L** to load EPG data (optional)
5. Start watching!

---

## ⚖️ Legal Notice

This application does **not** provide any content. Users must supply their own legal playlists. Streaming copyrighted content without authorization is illegal.

---

## 📖 Documentation

- [User Guide](https://github.com/ColinGamez/JPTV-Player/blob/main/docs/USER_GUIDE.md)
- [TV Box Mode](https://github.com/ColinGamez/JPTV-Player/blob/main/docs/TV_BOX_MODE.md)
- [FAQ](https://github.com/ColinGamez/JPTV-Player/blob/main/docs/FAQ.md)
```
