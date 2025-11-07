# Release Notes Template

Use this template when creating new releases. Copy the relevant sections based on your release type.

---

## Feature Release Template

```markdown
## ✨ New Features

### [Feature Name]
Brief description of what this feature does and why it's useful:
- **Key Point 1**: Description
- **Key Point 2**: Description
- **Key Point 3**: Description
- **Key Point 4**: Description

### [Another Feature Name] (if applicable)
Brief description:
- **Key Point 1**: Description
- **Key Point 2**: Description

## 🔧 Technical Implementation

- Technical detail 1
- Technical detail 2
- Technical detail 3
- IPC handlers/APIs added
- File changes summary

## 📦 Installation

Download the installer for your platform from the assets below.

For installation instructions, see the [README](https://github.com/sandeepuppalapati/project-ka#-quick-start).

## 🚀 Usage

**Only include this section if the feature has new UI or requires user action.**

Step-by-step guide on how to use the new feature:
1. Step 1
2. Step 2
3. Step 3

---

**Full Changelog**: https://github.com/sandeepuppalapati/project-ka/compare/vX.X.X...vX.X.X
```

---

## Bug Fix Release Template

```markdown
## 🐛 Bug Fixes

### Fixed [Issue Name]
Description of what was broken and how it's fixed:
- **Root Cause**: What was causing the issue
- **Solution**: How it was fixed
- **Impact**: What users will notice

## 🔧 What was fixed

Detailed explanation of:
1. The problem
2. Why it happened
3. How it was solved
4. Any side effects or improvements

## 📦 Installation

Download the installer for your platform from the assets below.

For installation instructions, see the [README](https://github.com/sandeepuppalapati/project-ka#-quick-start).

---

**Full Changelog**: https://github.com/sandeepuppalapati/project-ka/compare/vX.X.X...vX.X.X
```

---

## Mixed Release Template (Features + Bug Fixes)

```markdown
## ✨ New Features

### [Feature Name]
Brief description:
- **Key Point 1**: Description
- **Key Point 2**: Description

## 🐛 Bug Fixes

### Fixed [Issue Name]
- **Root Cause**: Description
- **Solution**: Description

## 🔧 Technical Changes

**New Features:**
- Technical detail 1
- Technical detail 2

**Bug Fixes:**
- Technical detail 1
- Technical detail 2

## 📦 Installation

Download the installer for your platform from the assets below.

For installation instructions, see the [README](https://github.com/sandeepuppalapati/project-ka#-quick-start).

---

**Full Changelog**: https://github.com/sandeepuppalapati/project-ka/compare/vX.X.X...vX.X.X
```

**Note:** Add a 🚀 Usage section if new features require user action.

---

## Patch Release Template (Minor fixes)

```markdown
## 🐛 Bug Fixes

- Fixed [issue 1]
- Improved [thing 1]
- Enhanced [thing 2]
- Updated [thing 3]

---

**Full Changelog**: https://github.com/sandeepuppalapati/project-ka/compare/vX.X.X...vX.X.X
```

---

## Release Process Checklist

When creating a release, follow these steps:

1. **Update version in package.json**
   ```bash
   # Update "version": "X.X.X"
   ```

2. **Update version badge in README.md**
   ```bash
   # Update ![Version](https://img.shields.io/badge/version-X.X.X-blue.svg)
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Commit changes**
   ```bash
   git add -A
   git commit -m "feat/fix: [description] (vX.X.X)"
   ```

5. **Create git tag**
   ```bash
   git tag -a vX.X.X -m "Release vX.X.X - [Name]

   [Brief summary of changes]"
   ```

6. **Push to GitHub**
   ```bash
   git push && git push --tags
   ```

7. **Create GitHub release**
   ```bash
   gh release create vX.X.X --title "vX.X.X - [Release Name]" --notes "$(cat <<'EOF'
   [Paste release notes from template above - DO NOT include title]
   EOF
   )"
   ```

   **Note:** The title is set with `--title`, so don't repeat it in the notes body.

---

## Emoji Guide

Use these emojis consistently in release notes:

- ✨ **New Features** - For new functionality
- 🐛 **Bug Fixes** - For bug fixes
- 🔧 **Technical Changes** - For implementation details
- 📦 **Installation** - For installation instructions
- 🚀 **Usage** - For usage instructions
- ⚡ **Performance** - For performance improvements
- 🎨 **Visual** - For UI/UX changes
- 🔒 **Security** - For security improvements
- 📝 **Documentation** - For docs updates
- 🎉 **Major Release** - For significant releases

---

## Tips

1. **Don't repeat the title**: Title is set with `--title`, don't include it in notes body
2. **Be clear and concise**: Users should quickly understand what's new
3. **Include context**: Explain why features were added or bugs fixed
4. **Add screenshots**: For visual features (use image uploads in GitHub)
5. **Link to issues**: Reference GitHub issues if applicable
6. **Highlight breaking changes**: Use ⚠️ **BREAKING CHANGES** section if needed
7. **Usage section**: Only include for features that require user action or have new UI
8. **Installation**: Link to README instead of repeating instructions
9. **Keep patch releases short**: Just list fixes and link to changelog
10. **Test release notes**: Preview them before publishing
11. **Consistent format**: Always include Full Changelog link
