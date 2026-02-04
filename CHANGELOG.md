# Changelog

All notable changes to JPTV Player will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] – 2026-02-05

### Added
- Initial stable release
- TV Box Mode with auto-play and fullscreen on startup
- Multi-profile system with separate favorites and settings
- M3U/M3U8 playlist support with category organization
- EPG (Electronic Program Guide) support with XMLTV import
- Favorites system (press F to toggle)
- Parental controls with PIN protection
- Direct channel selection via number keys (0-9)
- Auto-hide UI (menus disappear after 5 seconds of inactivity)
- Keyboard and remote control navigation
- In-app donation options (Ctrl+D)
- Profile corruption detection and auto-recovery
- VLC command queue for race-free playback
- Blocking shutdown handler (no orphaned processes)
- Centralized keyboard handling (no duplicate listeners)
- Navigation throttling for smooth operation
- Sample playlist included for testing

### Technical
- Electron 28.1.3 with React + TypeScript
- VLC backend with command serialization
- Zero race conditions in playback lifecycle
- Deterministic process cleanup
- Profile isolation and data persistence

---

## Future Releases

### Planned Features
- Custom EPG styling and themes
- Cloud playlist sync (optional)
- Recording/DVR functionality
- Multi-language support
- Plugin system for extensions

---

**Note:** This changelog tracks user-facing changes only. For detailed technical changes, see commit history on GitHub.
