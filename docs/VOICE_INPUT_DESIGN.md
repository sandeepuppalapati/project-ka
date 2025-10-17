# Voice Input Design - Speech Interface

**Date**: 2025-10-17 (Recreated)
**Status**: Web Speech API integrated, UI disabled (Phase 5 planned)

---

## Vision

Voice-first interface for coding. Developers should be able to:
- Describe features in natural language
- Issue commands hands-free
- Code while away from keyboard

**Key Principle**: Voice + Text hybrid, not voice-only.

---

## Current Implementation

### What's Built ✅

1. **Web Speech API Integration**
   - `SpeechRecognition` initialized in ChatPanel
   - Continuous recognition support
   - Interim results handling
   - Error recovery

2. **Transcription State**
   - Real-time transcript preview
   - Append to input field on finalization
   - Visual feedback during recording

### Why Disabled?

Voice button hidden in UI (line 396-404 in ChatPanel.tsx):

```typescript
{/* Voice button hidden until API integration is complete */}
```

**Reason**: Focus on core AI functionality first. Voice is enhancement, not requirement.

---

## Voice Input Modes

### Mode 1: Push-to-Talk (PTT) - Recommended

**How it Works**:
- Hold Space bar → Start listening
- Speak command
- Release Space → Stop listening, process

**Pros**:
- ✅ Clear start/stop
- ✅ No accidental triggers
- ✅ Works in noisy environments
- ✅ Low battery usage

**Cons**:
- ⚠️ Requires hand on keyboard

**UI Design**:
```
┌──────────────────────────────┐
│ [Hold Space to Talk]         │
│                              │
│ OR                           │
│                              │
│ 🎤 [Click & Hold]            │
└──────────────────────────────┘
```

### Mode 2: Always-On Listening - Optional

**How it Works**:
- Toggle "Always Listen" mode
- Say wake word: "Hey AI" or "Claude"
- System activates
- Speak command
- Deactivates after response

**Pros**:
- ✅ Truly hands-free
- ✅ Natural conversation flow

**Cons**:
- ❌ Accidental triggers
- ❌ Privacy concerns
- ❌ Higher battery usage
- ❌ Needs wake word detection

**UI Design**:
```
┌──────────────────────────────┐
│ [🎤 Always Listening] ON     │
│                              │
│ Say "Hey AI" to activate     │
│                              │
│ [Turn Off]                   │
└──────────────────────────────┘
```

### Mode 3: Hybrid (Planned Default)

**How it Works**:
- Default: PTT for commands
- Optional: Enable always-on for short sessions
- User choice in settings

**Best of Both Worlds**:
- Use PTT when focused on keyboard
- Use always-on when brainstorming away from desk

---

## Technical Implementation

### Speech Recognition API

```typescript
// Initialize
const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
const recognition = new SpeechRecognition()

recognition.continuous = false  // Stop after one phrase
recognition.interimResults = true  // Show partial results
recognition.lang = 'en-US'

// Handle results
recognition.onresult = (event) => {
  let interimTranscript = ''
  let finalTranscript = ''

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript
    if (event.results[i].isFinal) {
      finalTranscript += transcript
    } else {
      interimTranscript += transcript
    }
  }

  if (finalTranscript) {
    setInput(prev => prev + finalTranscript)
    setTranscript('')
  } else {
    setTranscript(interimTranscript)  // Show preview
  }
}
```

### Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Yes | webkitSpeechRecognition |
| Edge | ✅ Yes | webkitSpeechRecognition |
| Safari | ⚠️ Limited | Some features missing |
| Firefox | ❌ No | No native support |
| Electron | ✅ Yes | Uses Chromium |

**Fallback**: If not supported, hide voice button, show text-only.

---

## Technical Term Handling

### Challenge

Voice recognition struggles with:
- Variable names: "useEffect", "useState"
- Library names: "React", "TypeScript"
- File paths: "src/components/App.tsx"
- Commands: "npm install", "git commit"

### Solution 1: Post-Processing (AI Correction)

```
User says: "add use effect hook"
Raw transcript: "add use effect hook"
AI corrects: "add useEffect hook"
```

AI already good at this - no special handling needed.

### Solution 2: Custom Vocabulary

```typescript
const customVocabulary = {
  'use effect': 'useEffect',
  'use state': 'useState',
  'use memo': 'useMemo',
  'react': 'React',
  'type script': 'TypeScript',
  'git': 'git',
  'npm': 'npm'
}

function correctTranscript(text: string): string {
  let corrected = text
  for (const [wrong, right] of Object.entries(customVocabulary)) {
    corrected = corrected.replace(new RegExp(wrong, 'gi'), right)
  }
  return corrected
}
```

### Solution 3: Context-Aware Suggestions

```
User says: "use memo"
Context: Writing React code
AI suggests: useCallback, useMemo, useEffect
```

**Decision**: Start with AI correction (already works), add custom vocab if needed.

---

## Real-Time Transcription UI

### Design

```
┌────────────────────────────────────────────┐
│ Chat Input                                 │
├────────────────────────────────────────────┤
│                                            │
│ Add authentication to the API              │
│                                            │
│ ┌────────────────────────────────────────┐│
│ │ 🎤 "and make sure to hash passwords"   ││ ← Interim
│ └────────────────────────────────────────┘│
│                                            │
│ [🎤 Recording...] [Send]                   │
└────────────────────────────────────────────┘
```

**Features**:
- Blue background for interim text
- Italics to show "not finalized"
- Pulses during recording
- Disappears when finalized

### Current Implementation

```typescript
{transcript && (
  <div className="transcript-preview">{transcript}</div>
)}
```

```css
.transcript-preview {
  position: absolute;
  bottom: 100%;
  background-color: rgba(14, 99, 156, 0.2);
  border: 1px solid #0e639c;
  padding: 0.5rem;
  color: #0e639c;
  font-style: italic;
}
```

---

## Voice Commands

### Natural Language (Preferred)

```
"Add a contact form to the homepage"
"Fix the bug in the login function"
"Run the tests"
"Show me the package.json file"
```

AI interprets naturally - no special syntax needed.

### Direct Commands (Optional Enhancement)

```
"Open file src/App.tsx"        → Opens file
"Switch to branch feature/new" → Git checkout
"Commit with message 'fixes'"  → Git commit
```

**Implementation**: Pattern matching in ChatPanel before sending to AI.

---

## Privacy & Security

### Concerns

1. **Microphone Access**: User must grant permission
2. **Recording Privacy**: No audio saved locally
3. **Cloud Processing**: Google servers process speech
4. **Sensitive Info**: Code/keys might be spoken

### Safeguards

1. **Explicit Permission**:
   ```typescript
   const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
   ```
   Browser shows permission prompt.

2. **Visual Indicator**:
   ```
   🎤 Recording...  ← Always visible when mic active
   ```

3. **No Storage**:
   - Audio not saved to disk
   - Only text transcript kept
   - Transcript in chat history (optional)

4. **User Control**:
   - Easy disable in settings
   - Clear UI when listening
   - Instant stop with Esc key

---

## Error Handling

### No Microphone Permission

```
User: Clicks voice button
Browser: Denies permission
IDE: "Microphone access denied. Enable in browser settings."
```

### Network Error

```
Speech API: Network error
IDE: Falls back to text input
Alert: "Voice recognition unavailable. Using text input."
```

### No Speech Detected

```
User: Holds space but doesn't speak
Recognition: "no-speech" error
IDE: Ignores, waits for next attempt
```

### Ambient Noise

```
Recognition: Low confidence scores
IDE: Shows "Couldn't understand. Try again?"
User: Repeats or switches to text
```

---

## Keyboard Shortcuts

### Voice-Related

- **Space (hold)**: Activate PTT
- **Esc**: Cancel recording
- **Ctrl+M**: Toggle always-on mode (future)

### Existing

- **Enter**: Send message
- **Shift+Enter**: New line
- **↑/↓**: History navigation
- **Ctrl+/**: Focus input

---

## Accessibility

### For Users Who Can't Type

Voice input is primary accessibility feature:
- Hands-free operation
- Verbally issue commands
- Navigate with voice

### For Users Who Can't Speak

Text input always available:
- Never voice-only
- All features work with keyboard
- Screen reader compatible (future)

---

## Performance Considerations

### Latency

```
User speaks → Recognition → Transcript → AI → Response
   0ms          ~500ms        instant    2-3s    0ms
```

Total: ~3-4 seconds

**Optimization**:
- Start AI processing on interim results (risky)
- Preload context while listening
- Use faster AI model for voice

### Battery Usage

- **PTT**: Minimal (mic on only when held)
- **Always-On**: High (mic always active)

**Recommendation**: Default to PTT, warn before always-on.

---

## UI/UX Design

### Voice Button States

```css
/* Idle */
.voice-button {
  background: #3c3c3c;
  border: 2px solid #3e3e42;
}

/* Hover */
.voice-button:hover {
  background: #4e4e4e;
  border-color: #0e639c;
}

/* Recording */
.voice-button.recording {
  background: #f14c4c;
  border-color: #f14c4c;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

### Placement

**Option 1**: Left of input (current hidden implementation)
```
[🎤] [___________________] [Send]
```

**Option 2**: Floating button (future)
```
[___________________] [Send]

      [🎤]  ← Bottom-right corner
```

**Decision**: Option 1 for now, Option 2 for mobile/tablet.

---

## Platform Considerations

### Desktop (Electron)

- Native speech recognition via Chromium
- Microphone permission via browser APIs
- Works offline (if model downloaded)

### Web (Future)

- Same Web Speech API
- Browser compatibility varies
- Requires internet

### Mobile (Future)

- Native speech APIs (iOS/Android)
- Better accuracy
- Lower latency

---

## Testing Strategy

### Manual Testing

1. **Microphone Permission**:
   - Deny → Shows error
   - Allow → Starts recording

2. **Recognition Accuracy**:
   - Simple phrases → 95%+ accuracy
   - Technical terms → Test with custom vocab
   - Code snippets → Verify AI correction

3. **Error Recovery**:
   - Network loss → Graceful fallback
   - No speech → Ignore, don't error
   - Noise → Show "Couldn't understand"

### Automated Testing

- Mock SpeechRecognition API
- Simulate various events
- Test state transitions

---

## Internationalization (Future)

### Language Support

```typescript
recognition.lang = userSettings.language || 'en-US'
```

**Supported Languages**:
- English: en-US, en-GB, en-AU
- Spanish: es-ES, es-MX
- French: fr-FR
- German: de-DE
- Chinese: zh-CN
- Japanese: ja-JP

**Challenge**: Technical terms in non-English languages.

---

## Alternative Speech Engines

### Web Speech API (Current)

**Pros**:
- ✅ Free
- ✅ Built into browser
- ✅ No setup

**Cons**:
- ❌ Requires internet
- ❌ Privacy concerns (Google)
- ❌ Limited customization

### OpenAI Whisper (Future)

**Pros**:
- ✅ Higher accuracy
- ✅ Better with technical terms
- ✅ Multilingual

**Cons**:
- ❌ Costs money
- ❌ Requires API integration
- ❌ Higher latency

### Local Models (Future)

**Pros**:
- ✅ Privacy (offline)
- ✅ No API costs
- ✅ Customizable

**Cons**:
- ❌ Requires powerful hardware
- ❌ Setup complexity
- ❌ Model size

**Decision**: Start with Web Speech API, add Whisper in Phase 5.

---

## Implementation Roadmap

### Phase 5A: Enable Basic Voice

- [ ] Unhide voice button
- [ ] Test microphone permissions
- [ ] Test PTT functionality
- [ ] Add error messaging
- [ ] User testing

### Phase 5B: Improve Accuracy

- [ ] Add custom vocabulary
- [ ] Context-aware corrections
- [ ] User-defined shortcuts
- [ ] Confidence threshold tuning

### Phase 5C: Advanced Features

- [ ] Always-on mode
- [ ] Wake word detection
- [ ] Voice commands
- [ ] Multi-language support

### Phase 5D: Alternative Engines

- [ ] OpenAI Whisper integration
- [ ] Local model support (Whisper.cpp)
- [ ] Engine selection in settings

---

## User Settings (Planned)

```typescript
interface VoiceSettings {
  enabled: boolean
  mode: 'ptt' | 'always-on' | 'hybrid'
  language: string
  customVocabulary: Record<string, string>
  engine: 'web-speech' | 'whisper' | 'local'
  wakeWord?: string
  confidence: number  // 0.0 - 1.0
}
```

**UI**:
```
┌──────────────────────────────────┐
│ Voice Input Settings             │
├──────────────────────────────────┤
│ [✓] Enable Voice Input           │
│                                  │
│ Mode: [v Push-to-Talk        ]  │
│                                  │
│ Language: [v English (US)    ]  │
│                                  │
│ Engine: [v Web Speech API    ]  │
│                                  │
│ Custom Vocabulary:               │
│ ┌──────────────────────────────┐│
│ │ use effect → useEffect       ││
│ │ [Add Term]                   ││
│ └──────────────────────────────┘│
│                                  │
│ [Save] [Cancel]                  │
└──────────────────────────────────┘
```

---

*Last Updated: 2025-10-17*
*Status: Web Speech API integrated, voice button disabled in UI, Phase 5 planned*
