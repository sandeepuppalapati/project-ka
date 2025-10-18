# Future Improvements

## File System Auto-Refresh
**Status**: Pending
**Priority**: Medium
**Current**: Manual refresh button (↻) in file tree header
**Desired**: Automatic file tree refresh when files change

### Implementation Notes
- Need to add file system watcher in main process (use `chokidar` or Node's `fs.watch`)
- Set up IPC events to notify renderer when files change in watched repos
- Throttle/debounce refresh events to avoid performance issues
- Only watch repos that are currently active/visible

### Dependencies
- `chokidar` package (recommended over native fs.watch for cross-platform support)

### Related Files
- `/Users/sandeep/GIT/project-ka/src/renderer/components/FileTree.tsx`
- `/Users/sandeep/GIT/project-ka/src/main/main.ts` (will need file watcher setup)

---

## Other Future Enhancements
(Add more as they come up)
