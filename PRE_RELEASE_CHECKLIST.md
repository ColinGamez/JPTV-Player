# Pre-Release Checklist

Use this checklist before publishing each GitHub Release.

---

## 📦 Build & Package

- [ ] Version number updated in `package.json`
- [ ] Version number updated in `electron/main.ts` (if displayed)
- [ ] Changelog updated with new features/fixes
- [ ] All code committed and pushed to `main` branch
- [ ] Git tag created: `git tag v1.0.0`
- [ ] Tag pushed: `git push origin v1.0.0`

### Build Commands
```bash
npm run build        # Build renderer + main
npm run dist         # Create installer and portable
```

- [ ] Build completed without errors
- [ ] Installer created: `release/JPTV-Player-Setup-x.x.x.exe`
- [ ] Portable ZIP created (optional): `release/JPTV-Player-Portable-x.x.x.zip`

---

## 🧪 Testing (Critical Path)

### Installer Test
- [ ] Run installer on clean Windows 10 machine
- [ ] Installer completes without errors
- [ ] Start Menu shortcut created
- [ ] Desktop shortcut created (if enabled)
- [ ] App launches successfully
- [ ] Uninstaller works correctly

### App Functionality Test
- [ ] First launch: Profile creation works
- [ ] Load playlist (press O): File dialog opens
- [ ] Sample playlist loads correctly
- [ ] Channels display in list
- [ ] Channel playback starts (audio + video)
- [ ] Arrow keys navigate correctly
- [ ] F11 toggles fullscreen
- [ ] ESC returns to channel list
- [ ] Favorites system works (press F)
- [ ] EPG loading works (press L)
- [ ] Profile switch works
- [ ] App closes cleanly (no orphaned processes)
- [ ] Reopen app: Last channel restored
- [ ] Settings persist across restarts

### Stress Test (Quick)
- [ ] Rapid channel switching (20+ times) – no crashes
- [ ] Force-close app (Task Manager) – restarts cleanly
- [ ] Run for 30 minutes – no memory leaks

---

## 📝 Documentation

- [ ] README.md uses user-focused language (not dev-focused)
- [ ] README.md links to `/docs` folder
- [ ] `docs/USER_GUIDE.md` exists and is complete
- [ ] `docs/FAQ.md` exists with common questions
- [ ] `docs/TV_BOX_MODE.md` exists (or moved from root)
- [ ] All documentation links are valid (no 404s)
- [ ] Screenshots included in docs (if applicable)
- [ ] Legal disclaimer prominently displayed

### Documentation Checklist
- [ ] No references to "building" or "compiling"
- [ ] No references to Node.js, npm, Electron (user-facing docs)
- [ ] Download link points to GitHub Releases
- [ ] Keyboard shortcuts documented
- [ ] System requirements listed
- [ ] Legal notice included

---

## ⚖️ Legal & Safety

- [ ] Legal disclaimer in README
- [ ] Legal disclaimer in release notes
- [ ] First-launch disclaimer implemented (optional but recommended)
- [ ] No bundled playlists with copyrighted content
- [ ] Sample playlist uses only legal/test streams
- [ ] No affiliation claims with broadcasters

---

## 🔗 Links & References

- [ ] GitHub repository URL correct
- [ ] GitHub Releases page accessible
- [ ] GitHub Issues enabled
- [ ] GitHub Discussions enabled (optional)
- [ ] Sponsor link configured (if using GitHub Sponsors)
- [ ] License file present (MIT or other)
- [ ] Changelog file present

---

## 📦 Release Assets

### Required Files
- [ ] `JPTV-Player-Setup-x.x.x.exe` – Windows installer
  - [ ] File size reasonable (< 100 MB)
  - [ ] Filename follows naming convention

### Optional Files
- [ ] `JPTV-Player-Portable-x.x.x.zip` – Portable version
- [ ] `CHECKSUMS-x.x.x.txt` – SHA256 hashes for verification
- [ ] `README.txt` – Plain text instructions (for offline users)

### Asset Validation
- [ ] All files uploaded to release
- [ ] File sizes match expected values
- [ ] Download links work (test in incognito mode)

---

## 🎯 Release Description

- [ ] Release title follows format: `v1.0.0 – TV Box Release`
- [ ] Release description includes:
  - [ ] Download links
  - [ ] What's new (features/fixes)
  - [ ] Installation instructions
  - [ ] Legal disclaimer
  - [ ] Link to documentation
  - [ ] Known issues (if any)
- [ ] Changelog linked or included
- [ ] Professional tone (no casual language)
- [ ] No broken markdown formatting

---

## 🌐 Repository Cleanup

### Files to REMOVE (or move to `.github/` or `dev/`)
- [ ] Build instructions (or move to CONTRIBUTING.md for developers)
- [ ] `PARSER.md` (internal dev docs)
- [ ] `HARDENING_SPRINT.md` (internal dev notes)
- [ ] Any dev-focused READMEs
- [ ] Temporary test files

### Files to KEEP
- [ ] LICENSE
- [ ] README.md (user-focused)
- [ ] CHANGELOG.md
- [ ] sample-playlist.m3u8
- [ ] `/docs` folder
- [ ] `.gitignore`

### Files in `.gitignore`
- [ ] `/dist`
- [ ] `/release`
- [ ] `/node_modules`
- [ ] `/build` (if used)
- [ ] `*.log`
- [ ] `.env` files

---

## 🚀 GitHub Release Publishing

- [ ] Draft release created on GitHub
- [ ] Release tagged with correct version
- [ ] Assets uploaded
- [ ] Release description formatted correctly
- [ ] "Set as latest release" checked
- [ ] "Create a discussion for this release" checked (optional)
- [ ] Release published (not draft)

---

## 📢 Post-Release

- [ ] Test download from Releases page
- [ ] Test installer on fresh machine
- [ ] Update any external links (website, social media)
- [ ] Announce in Discussions (optional)
- [ ] Monitor Issues for bug reports
- [ ] Respond to user questions within 24-48 hours

---

## 🔍 Final Sanity Check

Before clicking "Publish Release":

1. **Download your own release**
2. **Install on a VM or test machine**
3. **Complete the entire first-run experience**
4. **Verify all features work**
5. **Check for obvious bugs**
6. **Read through release notes one more time**

**If everything passes → Publish!**

---

## 📊 Version Number Strategy

Use [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes, major features
- **MINOR** (1.1.0): New features, backward-compatible
- **PATCH** (1.0.1): Bug fixes, small improvements

Examples:
- `v1.0.0` – Initial stable release
- `v1.1.0` – Added EPG feature
- `v1.1.1` – Fixed EPG bug
- `v2.0.0` – Complete UI redesign (breaking change)

---

## 🐛 Hotfix Release Process

If critical bug found after release:

1. **Create hotfix branch**: `git checkout -b hotfix/1.0.1`
2. **Fix the bug**
3. **Update version**: `1.0.0` → `1.0.1`
4. **Test thoroughly**
5. **Merge to main**: `git checkout main && git merge hotfix/1.0.1`
6. **Tag**: `git tag v1.0.1`
7. **Build & release**
8. **Release notes**: Focus on what was fixed

**Hotfix releases should be fast (same day or next day).**

---

## ✅ Sign-Off

**Release Manager**: _________________  
**Date**: _________________  
**Version**: _________________  

**All checks passed?** → Publish Release

**Issues found?** → Fix and re-check

---

**Remember**: Once published, releases are permanent (even if deleted, users may have downloaded). Test thoroughly before publishing.
