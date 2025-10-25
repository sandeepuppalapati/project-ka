# 🔒 AI IDE v0.2.1 - Security Update

## 🚨 Security Fixes

- **Encrypted API Key Storage**: API keys are now encrypted using OS-level encryption instead of plain text
  - **macOS**: Stored in Keychain
  - **Windows**: Encrypted with DPAPI (Data Protection API)
  - **Linux**: Uses Secret Service API / libsecret
- **Automatic Migration**: Existing plain text API keys are automatically migrated to encrypted storage on first launch
- **Zero User Action**: Upgrade is seamless - your API key continues to work without any configuration

## 🔐 What This Means for You

**If you're upgrading from v0.1.0 or v0.2.0:**
- Your API key will be automatically encrypted on first launch
- No action needed - everything continues to work
- Your API key is now protected by your OS security

**If you're installing fresh:**
- API keys are encrypted from the start
- Maximum security by default

## 📦 Downloads

- **macOS (Apple Silicon)**: `AI IDE-0.2.1-arm64.dmg`
- **macOS (Intel)**: `AI IDE-0.2.1.dmg`
- **Windows**: `AI IDE Setup 0.2.1.exe` (Installer) / `AI IDE 0.2.1.exe` (Portable)
- **Linux**: `AI IDE-0.2.1.AppImage` / `ai-ide_0.2.1_amd64.deb`

## 🔗 Related Issues

- Fixes #3 - Security: API keys stored in plain text
- Fixes #4 - Auto-migrate plain text API keys to encrypted storage

## 📝 Changes Since v0.2.0

**Security:**
- Encrypt API keys using Electron's safeStorage API
- Auto-migrate existing plain text keys to encrypted storage

## 📝 Full Changelog (v0.1.0 → v0.2.1)

**New Features:**
- Open any folder (not just git repositories)
- Git-optional mode

**Performance:**
- Large repository optimization
- Smart directory filtering (skips node_modules, .git, etc.)

**Bug Fixes:**
- Windows/Linux close button now visible
- Folder access validation removed

**Security:**
- API keys now encrypted with OS keychain
- Automatic migration from plain text

---

## ⚠️ Upgrading from v0.2.0

If you installed v0.2.0, please upgrade to v0.2.1 for the security improvements. Your API key will be automatically encrypted on first launch.

## 📥 Installation

1. Download the appropriate installer for your platform
2. Install/run the application
3. Your existing settings will be automatically migrated
4. Start coding with AI!
