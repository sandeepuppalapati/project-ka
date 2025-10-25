# 🚀 AI IDE v0.2.0 - Performance & Usability Improvements

## ✨ New Features

- **Open Any Folder**: No longer restricted to git repositories! You can now open any folder on your system, including subfolders within repos
- **Git-Optional**: Git features (branch, status) are now optional - works seamlessly with both git and non-git folders

## ⚡ Performance Improvements

- **Large Repository Optimization**: Significantly improved performance when opening large repositories
- **Smart Directory Filtering**: Automatically skips heavy directories (node_modules, .git, dist, build, coverage, etc.) in file tree
- **Faster Loading**: Reduced initial load time for large codebases

## 🐛 Bug Fixes

- **Windows/Linux**: Fixed missing close button on Windows and Linux (title bar now shows properly)
- **Folder Access**: Removed unnecessary git repository validation that blocked opening regular folders

## 📦 Downloads

- **macOS (Apple Silicon)**: `AI IDE-0.2.0-arm64.dmg`
- **macOS (Intel)**: `AI IDE-0.2.0.dmg`
- **Windows**: `AI IDE Setup 0.2.0.exe` (Installer) / `AI IDE 0.2.0.exe` (Portable)
- **Linux**: `AI IDE-0.2.0.AppImage` / `ai-ide_0.2.0_amd64.deb`

## 🔗 Related Issues

- Fixes #1 - Performance: Large repositories take too long to load
- Fixes #2 - Feature: Allow opening any folder, not just git repositories

## 📝 Full Changelog

**Commits since v0.1.0:**
- Fix: Allow opening any folder and optimize large repo performance
- Fix: Show standard title bar with close button on Windows/Linux
- Add issue templates for bug reports and feature requests

---

## 🙏 Thank You

Thanks to early users for reporting these issues and helping improve AI IDE!

## 📥 Installation

1. Download the appropriate installer for your platform
2. Install/run the application
3. Enter your Anthropic API key in Settings
4. Start coding with AI!
