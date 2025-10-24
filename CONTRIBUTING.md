# Contributing to AI IDE

First off, thank you for considering contributing to AI IDE! It's people like you that make AI IDE such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps to reproduce the problem**
* **Provide specific examples** to demonstrate the steps
* **Describe the behavior you observed** and what you expected to see
* **Include screenshots or animated GIFs** if possible
* **Include your environment details**: OS, Node.js version, Electron version

**Bug Report Template:**
```markdown
## Description
[Clear description of the bug]

## Steps to Reproduce
1.
2.
3.

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- OS: [e.g., macOS 14.0]
- Node.js: [e.g., v18.17.0]
- AI IDE version: [e.g., 0.1.0]
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

* **Use a clear and descriptive title**
* **Provide a detailed description** of the suggested enhancement
* **Explain why this enhancement would be useful** to most users
* **List any alternatives** you've considered

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following our coding standards
3. **Test your changes** thoroughly
4. **Update documentation** as needed
5. **Write meaningful commit messages**
6. **Submit a pull request**

#### Pull Request Process

1. Update the README.md with details of changes if applicable
2. Follow the existing code style and conventions
3. Write clear, concise commit messages
4. Include tests for new features
5. Ensure all tests pass
6. Request review from maintainers

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Git
- Anthropic API key

### Getting Started

1. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ai-ide.git
   cd ai-ide
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your ANTHROPIC_API_KEY
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

### Project Structure

```
ai-ide/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # Entry point, IPC handlers
│   │   └── preload.ts     # Secure IPC bridge
│   └── renderer/          # React UI
│       ├── components/    # React components
│       ├── hooks/         # Custom React hooks
│       └── App.tsx        # Main app component
├── docs/                  # Documentation
├── dist/                  # Build output (gitignored)
└── package.json
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict type checking
- Avoid `any` types when possible
- Use interfaces for object shapes

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add semicolons at the end of statements
- Follow existing naming conventions:
  - `camelCase` for variables and functions
  - `PascalCase` for components and classes
  - `UPPER_CASE` for constants

### React Components

- Use functional components with hooks
- Keep components focused and single-purpose
- Use meaningful prop and state names
- Add PropTypes or TypeScript interfaces

### Git Commits

Write clear, meaningful commit messages following this format:

```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Example:**
```
feat: Add file watching and auto-refresh

- Implement chokidar for file system monitoring
- Auto-refresh file tree when files change externally
- Show notification when files are modified

Closes #42
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Write tests for new features
- Maintain or improve code coverage
- Test edge cases and error conditions
- Use descriptive test names

## Building

### Development Build

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Type Checking

```bash
npm run type-check
```

## Documentation

- Update documentation for any user-facing changes
- Add JSDoc comments for public APIs
- Keep README.md up to date
- Document complex algorithms or business logic

## Questions?

Feel free to open an issue with the `question` label or reach out via:

- GitHub Issues
- GitHub Discussions

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes
- Project README (for significant contributions)

## License

By contributing to AI IDE, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to AI IDE! 🎉
