# Git Hooks for Development

## Overview

Git hooks are scripts that run automatically when specific git events occur. They help maintain code quality, enforce standards, and automate workflows.

**For this project (initial MVP), we're keeping hooks minimal to avoid complexity.**

---

## Recommended Git Hooks (Phase 1)

### Pre-Commit Hook

**Purpose**: Run before commits to ensure code quality

**What it should do**:
- ✅ Run TypeScript compiler (`tsc --noEmit`)
- ✅ Run linter (if we add ESLint later)
- ⏳ Run basic tests (when we add them)

**Setup** (using Husky):

```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run type-check"
```

**Script in package.json**:
```json
{
  "scripts": {
    "type-check": "tsc --noEmit && tsc -p tsconfig.main.json --noEmit"
  }
}
```

**Status**: ⏳ **NOT IMPLEMENTED YET** - Focus on features first

---

## Optional Git Hooks (Post-MVP)

### Commit-Msg Hook

**Purpose**: Enforce commit message conventions

**What it should do**:
- ✅ Validate commit message format
- ✅ Enforce conventional commits (feat:, fix:, docs:, etc.)

**Example format**:
```
feat: Add multi-repo support
fix: Resolve git status error
docs: Update README with new features
```

**Setup**:
```bash
npx husky add .husky/commit-msg 'npx commitlint --edit $1'
npm install --save-dev @commitlint/cli @commitlint/config-conventional
```

**Status**: ⏳ **DEFER TO LATER** - Not needed for solo dev

---

### Pre-Push Hook

**Purpose**: Run before pushing to remote

**What it should do**:
- ✅ Run full test suite
- ✅ Verify build succeeds
- ✅ Check for debugging code (console.log, debugger)

**Setup**:
```bash
npx husky add .husky/pre-push "npm run build && npm test"
```

**Status**: ⏳ **DEFER TO LATER** - Add when we have tests

---

## Current Recommendation

**For Week 1-12 (MVP Development):**

### Don't Add Hooks Yet

**Why?**
1. ✅ **Speed over process** - Focus on building features
2. ✅ **Solo developer** - You control quality manually
3. ✅ **Avoid friction** - Hooks can slow you down
4. ✅ **Claude Code helps** - AI already ensures quality

**When to add:**
1. ⏳ After MVP launch (Week 12+)
2. ⏳ When adding contributors
3. ⏳ When test suite exists
4. ⏳ When you have time to set up properly

---

## Git Workflow (Without Hooks)

**Current approach for solo development:**

### Daily Workflow:

```bash
# 1. Before committing:
npm run dev  # Ensure app still works
# Manual check: TypeScript errors in terminal

# 2. Commit:
git add .
git commit -m "feat: Add chat panel component"

# 3. Push when ready:
git push origin main
```

**Manual quality checks:**
- ✅ TypeScript compiler running in `npm run dev:main`
- ✅ Visual check in Electron app
- ✅ Claude Code reviews your code
- ✅ Common sense

**This is enough for now!**

---

## Post-Launch Git Hooks (v1.1+)

**After successful launch, when adding contributors:**

### Recommended Setup:

**1. Pre-Commit**:
```bash
#!/bin/sh
# Type check
npm run type-check || exit 1

# Linting
npm run lint || exit 1

# Format check
npm run format:check || exit 1
```

**2. Commit-Msg**:
```bash
#!/bin/sh
# Enforce conventional commits
npx commitlint --edit $1
```

**3. Pre-Push**:
```bash
#!/bin/sh
# Build check
npm run build || exit 1

# Run tests
npm test || exit 1
```

**Tools needed**:
```bash
npm install --save-dev \
  husky \
  @commitlint/cli \
  @commitlint/config-conventional \
  eslint \
  prettier
```

---

## Husky Configuration Example

**When you're ready to add hooks:**

**package.json**:
```json
{
  "scripts": {
    "prepare": "husky install",
    "type-check": "tsc --noEmit && tsc -p tsconfig.main.json --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "format:check": "prettier --check 'src/**/*.{ts,tsx,css}'",
    "format": "prettier --write 'src/**/*.{ts,tsx,css}'",
    "test": "jest"
  },
  "devDependencies": {
    "husky": "^8.0.0",
    "@commitlint/cli": "^17.0.0",
    "@commitlint/config-conventional": "^17.0.0",
    "eslint": "^8.0.0",
    "prettier": "^2.8.0",
    "jest": "^29.0.0"
  }
}
```

**commitlint.config.js**:
```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Formatting
        'refactor', // Code restructure
        'test',     // Tests
        'chore',    // Maintenance
      ],
    ],
  },
};
```

---

## What We're Using Now

**Current setup**: ✅ **NONE**

**Why this works**:
- Solo development
- Claude Code ensures quality
- TypeScript catches errors
- Manual testing in Electron
- Fast iteration > process

**When we'll add hooks**:
- After MVP ships
- When onboarding contributors
- When test suite exists
- When we need enforcement

---

## Git Workflow Best Practices (Without Hooks)

### Commit Messages

**Current approach** (informal but clear):
```bash
git commit -m "Add multi-repo support"
git commit -m "Fix git status filter logic"
git commit -m "Update README with new docs"
```

**Good enough for solo dev!**

**After launch** (when hooks are added):
```bash
git commit -m "feat: Add multi-repo support"
git commit -m "fix: Resolve git status filter logic"
git commit -m "docs: Update README with new documentation"
```

---

## Branch Strategy

**Current**: ✅ **Main branch only**

**Why?**
- Solo developer
- Fast iteration
- Ship to production = push to main
- No complex workflows needed

**After launch**:
- `main` - Production
- `develop` - Integration
- `feature/*` - New features
- `fix/*` - Bug fixes

---

## CI/CD Integration

**Current**: ❌ **None**

**After launch** (GitHub Actions):

**.github/workflows/ci.yml**:
```yaml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run type-check
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

**Status**: ⏳ **Week 12** (launch prep)

---

## Decision Summary

### Now (Week 1-12):
- ❌ No git hooks
- ✅ Manual quality checks
- ✅ TypeScript compiler watching
- ✅ Claude Code reviews
- ✅ Fast iteration

### After Launch (Week 12+):
- ✅ Add Husky + pre-commit
- ✅ Add commitlint
- ✅ Add ESLint + Prettier
- ✅ Add pre-push tests
- ✅ Set up CI/CD

---

## Quick Reference

**If you want to add hooks RIGHT NOW**:

```bash
# 1. Install Husky
npm install --save-dev husky
npx husky install

# 2. Add prepare script
npm pkg set scripts.prepare="husky install"

# 3. Add pre-commit hook
npx husky add .husky/pre-commit "npm run type-check"

# 4. Add type-check script
npm pkg set scripts.type-check="tsc --noEmit && tsc -p tsconfig.main.json --noEmit"
```

**Done!** Now commits will fail if TypeScript has errors.

---

## My Recommendation

**DON'T add hooks yet.**

**Focus on:**
1. ✅ Building features
2. ✅ Shipping MVP in 3 months
3. ✅ Using Claude Code effectively
4. ✅ Manual quality control

**Add hooks after:**
- ✅ MVP is launched
- ✅ Contributors join
- ✅ Test suite exists
- ✅ Process is needed

**Hooks are for teams and mature projects.**
**You're in rapid prototyping mode.**
**Speed > Process.**

---

*Status: No hooks implemented (by design)*
*Decision: Add post-launch when needed*
*Current quality: TypeScript + Claude Code = Good enough*

**Keep shipping.** 🚀
