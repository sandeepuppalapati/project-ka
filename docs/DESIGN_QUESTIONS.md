# AI-Based IDE - Design Questions

## 1. Core User Experience
- How does a user start? (Launch app → voice command "create a todo app"?) yes
- What does the UI show? (AI chat interface + code preview + file tree?) yes
- Can users edit code manually as backup, or purely AI-driven?-yes, but not critical
- How do users review AI changes before applying? - auto apply or show file changes

## 2. AI Interaction Model
- Single conversation or multiple AI agents working together? - multiple, user can create agent groups or hierarchy
- How does AI understand context across multiple repos? - ide should maintain sessions
- Streaming responses or batch operations? streaming
- How to handle errors/failed generations? retries and track

## 3. Repository Management
- Open existing repos or clone from GitHub/GitLab? existing. later direct clone
- Work on multiple repos simultaneously (monorepo style)? - not mono repo.
- Auto-commit AI changes or require user approval? require, but user can auto
- Branch management - how does AI handle it? it will be part of the ide project. when user create project, while choosing repo folders, branch name will be provided

## 4. Project Creation
- Templates/scaffolding or pure AI generation? 
- How does AI choose tech stack (user specifies or AI decides)? based on exiting repos. suggest if new. but main use case is to work on existing repos
- Project wizard or conversational setup?wizard for starters

## 5. Voice Input
- Push-to-talk or always listening? optional
- Voice commands + text hybrid or voice-only? hybrid
- How to handle technical terms/code in voice?suggest
- Real-time transcription display?yes

## 6. Business Model (affects protection strategy)
- Commercial product (subscription/license)?tbd
- Open-source core + paid features?tbd
- Enterprise vs individual users?tbd
- Self-hosted or cloud-based AI?both
