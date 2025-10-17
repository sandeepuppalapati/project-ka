# Multi-Agent Bridge Architecture

> **"Bridge is like a group chat where AI agents coordinate"**

---

## Core Concept

Instead of a central orchestrator controlling everything, we use a **message bus** (the "bridge") where agents communicate like humans in a group chat.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    🌐 Bridge (Message Bus)              │
│  "Group chat where agents post updates and requests"    │
│                                                          │
│  [Backend Agent]: "Creating /api/auth/login..."         │
│  [Frontend Agent]: "👀 I'll wait and use that endpoint" │
│  [Backend Agent]: "✅ Done. POST /api/auth/login"       │
│  [Frontend Agent]: "Starting login form now..."         │
└─────────────────────────────────────────────────────────┘
         ↑              ↑              ↑
         │              │              │
    ┌────────┐     ┌────────┐     ┌────────┐
    │ Repo 1 │     │ Repo 2 │     │ Repo 3 │
    │ Agent  │     │ Agent  │     │ Agent  │
    └────────┘     └────────┘     └────────┘
```

---

## Key Principles

### 1. Decentralized Communication
- **No central orchestrator** - Agents are peers
- **No single point of failure** - Bridge is just a message bus
- **Agents decide** when to act, ignore, or ask

### 2. Agent Awareness
- Each agent knows **other agents exist** (minimal context)
- Agents can see **bridge messages** (group chat history)
- Agents maintain **focused context** on their own repo

### 3. Optional Participation
- Agents can **connect/disconnect** from bridge
- Agents can **ignore** irrelevant messages
- Agents can **ask confirmation** before acting

### 4. Autonomous Coordination
- Agents **post** when they're doing something
- Agents **listen** for relevant updates
- Agents **react** based on their judgment
- Agents **ask** when they need clarification

---

## Agent Behavior

### When an Agent Needs Something

**Agent posts to bridge:**
```
[Frontend Agent]: "I need a login endpoint.
                   Should return JWT token."
```

**Other agents can:**
- ✅ **Act**: "I'll create that endpoint"
- 🤔 **Ask**: "Do you need refresh tokens too?"
- 👀 **Ignore**: (not relevant to me)

### When an Agent is Doing Something

**Agent posts status updates:**
```
[Backend Agent]: "Working on authentication endpoint.
                  Will be at POST /api/auth/login"
```

**Other agents can:**
- 👀 **Watch**: "I'll wait for that"
- 🔗 **Connect**: "I'll use that endpoint when ready"
- ❓ **Question**: "What fields does it need?"

### When an Agent Completes Something

**Agent posts completion:**
```
[Backend Agent]: "✅ Done. POST /api/auth/login
                  Body: { email, password }
                  Returns: { token, user }"
```

**Other agents can:**
- ✅ **Proceed**: "Great, starting frontend now"
- 🧪 **Test**: "Let me verify it works"
- 📝 **Document**: "I'll update the API docs"

---

## Message Types

### 1. Status Messages
- **"Working on X"** - Agent is busy
- **"✅ Done with X"** - Agent completed task
- **"❌ Failed X"** - Agent encountered error
- **"⏸️ Paused X"** - Agent waiting for something

### 2. Request Messages
- **"Need X"** - Agent needs something from others
- **"Can someone X?"** - Agent asking for help
- **"Should I X?"** - Agent asking for confirmation

### 3. Info Messages
- **"FYI: X"** - Agent sharing relevant info
- **"Created X at Y"** - Agent announcing new resource
- **"Changed X to Y"** - Agent announcing modification

### 4. Question Messages
- **"How should I X?"** - Agent needs guidance
- **"What is X?"** - Agent needs clarification
- **"Where is X?"** - Agent needs location info

---

## UI Design

### Chat Tabs (Bottom Panel)

```
┌────────────────────────────────────────────────────┐
│ 🌐 Bridge | 📁 Backend | 📁 Frontend | 📁 Docs     │
├────────────────────────────────────────────────────┤
│                                                     │
│  [Backend Agent]: Working on auth endpoint...      │
│  [Frontend Agent]: 👀 Will wait for that          │
│  [Backend Agent]: ✅ Done. POST /api/auth/login   │
│  [You]: Great work! Now add password reset        │
│                                                     │
└────────────────────────────────────────────────────┘
```

### Repo-Specific Chats

Each repo has its own focused chat:
- **Only messages relevant to that repo**
- **Full file context for that repo**
- **Tools scoped to that repo**
- **Can still post to bridge**

### Bridge Chat (Global)

Group chat showing all agents:
- **Cross-repo coordination messages**
- **User can direct multiple agents**
- **Agents post updates visible to all**
- **User can observe agent collaboration**

---

## Connection Model

### Agent Connection States

1. **Connected** - Agent actively listening to bridge
2. **Disconnected** - Agent not listening (focused on own work)
3. **Observing** - Agent watching but not responding
4. **Active** - Agent currently responding/working

### When to Connect/Disconnect

**Connect when:**
- User asks to coordinate across repos
- Agent needs info from another repo
- Agent wants to share completion status

**Disconnect when:**
- Agent has focused work in own repo
- Bridge messages are irrelevant
- Agent wants to reduce context noise

---

## Example Workflows

### Workflow 1: User Asks Global Chat

```
User → Bridge: "Add user authentication to both backend and frontend"

[Bridge]: Task requires coordination across repos.
          Delegating to agents...

[Backend Agent]: I'll handle the API endpoint.
                 POST /api/auth/login with JWT.

[Frontend Agent]: I'll create the login form.
                  Will use the endpoint when ready.

[Backend Agent]: ✅ Endpoint complete.
                 Returns: { token: string, user: User }

[Frontend Agent]: Starting login form now...
[Frontend Agent]: ✅ Login form complete.
                  Using token for auth headers.

[Bridge]: ✅ Authentication complete across both repos.
```

### Workflow 2: Agent Asks for Help

```
[Frontend Agent]: I need the User type definition.
                  Where is it defined?

[Backend Agent]: It's in backend/src/types/user.ts
                 Let me share it...

[Backend Agent]:
    interface User {
      id: string;
      email: string;
      name: string;
    }

[Frontend Agent]: Thanks! Creating matching type on frontend.
```

### Workflow 3: Agent Detects Conflict

```
[Backend Agent]: ⚠️ Warning: Changing User.email to unique.
                This might break existing frontend code.

[Frontend Agent]: 👀 I see that. I'll update the validation
                 to handle unique email errors.

[Backend Agent]: ✅ Confirmed. Proceeding with migration.
```

---

## Technical Implementation

### Bridge Message Structure

```typescript
interface BridgeMessage {
  id: string;
  timestamp: Date;
  agentId: string;        // Which agent sent it
  agentName: string;      // e.g., "Backend Agent", "Frontend Agent"
  repoId?: string;        // Optional: which repo (if relevant)
  type: 'status' | 'request' | 'info' | 'question';
  content: string;        // The actual message
  metadata?: {
    taskId?: string;      // Link to specific task
    filesPaths?: string[]; // Relevant files
    dependsOn?: string[]; // Message IDs this depends on
  };
}
```

### Agent Context Structure

```typescript
interface AgentContext {
  agentId: string;
  repoPath: string;
  repoName: string;

  // Own conversation history
  conversationHistory: Message[];

  // Connection to bridge
  bridgeConnection: {
    connected: boolean;
    observing: boolean;
    lastRead: string; // Last bridge message ID seen
  };

  // Minimal context about other agents
  otherAgents: {
    agentId: string;
    repoName: string;
    status: 'idle' | 'working' | 'waiting';
  }[];
}
```

### AI System Prompt

**For Repo-Specific Agent:**
```
You are an AI agent working on the [REPO_NAME] repository.

You have access to a bridge (group chat) where other agents
working on different repositories can communicate.

When working on tasks:
- Post status updates to the bridge when relevant to other repos
- Watch bridge messages for info you need
- Ask questions in the bridge when you need help
- Coordinate with other agents when tasks span repos

Other agents in this project:
- Backend Agent (backend repo)
- Frontend Agent (frontend repo)
- Docs Agent (docs repo)

You can disconnect from the bridge to focus on your own work,
or connect when coordination is needed.
```

**For Bridge (Global Chat):**
```
You are the Bridge, a coordination layer for multiple AI agents
working across different repositories in the same project.

Your role:
- Facilitate communication between agents
- Help decompose cross-repo tasks
- Summarize multi-agent work for the user
- Ensure agents coordinate effectively

You don't do the work yourself - you help agents collaborate.
```

---

## Benefits of This Design

### 1. Scalability
- ✅ Add new repos/agents easily
- ✅ Agents don't need to know about all others
- ✅ Bridge doesn't get overwhelmed with complexity

### 2. Flexibility
- ✅ Agents can work independently
- ✅ Agents can collaborate when needed
- ✅ User can control at any level (repo or global)

### 3. Observability
- ✅ User sees agent coordination
- ✅ Transparent decision-making
- ✅ Easy to debug when things go wrong

### 4. Robustness
- ✅ One agent failing doesn't break others
- ✅ No single point of failure
- ✅ Agents can recover independently

### 5. Natural UX
- ✅ Mimics human team collaboration
- ✅ User can jump into any conversation
- ✅ Easy to understand agent behavior

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Message bus implementation
- [ ] Bridge chat UI
- [ ] Per-repo chat tabs
- [ ] Message routing

### Phase 2: Agent Communication
- [ ] AI system prompts for repo agents
- [ ] AI system prompt for bridge
- [ ] Agent posting to bridge
- [ ] Agent reading from bridge

### Phase 3: Coordination
- [ ] Agent awareness of others
- [ ] Status update mechanism
- [ ] Request/response patterns
- [ ] Dependency tracking

### Phase 4: Polish
- [ ] Visual indicators (agent working)
- [ ] Message threading
- [ ] Agent connection states
- [ ] Error handling across agents

---

## Open Questions

1. **How much bridge history should each agent see?**
   - Last 10 messages?
   - Last hour?
   - Only unread?

2. **Should agents auto-connect to bridge or manual?**
   - Auto when user uses global chat
   - Manual toggle per agent
   - Smart detection

3. **Can user talk directly to bridge or only through agents?**
   - User posts to bridge directly
   - User directs agents who post to bridge
   - Both

4. **How to handle agent conflicts?**
   - First agent wins
   - Agents negotiate
   - User decides

---

## Future Enhancements

### 1. Agent Roles
- **Architect Agent** - Designs across repos
- **Reviewer Agent** - Reviews changes across repos
- **Tester Agent** - Tests integration across repos
- **DevOps Agent** - Handles deployment across repos

### 2. Smart Routing
- Bridge can suggest which agents should respond
- AI-powered message relevance detection
- Auto-subscribe agents to relevant topics

### 3. Agent Memory
- Agents remember past cross-repo work
- Bridge maintains project-wide context
- Learning from successful coordination patterns

### 4. Visual Agent Map
- Show which agents are connected
- Visualize message flow
- Display dependencies

---

*Status: Architecture Design*
*Next: Implement message bus and bridge chat UI*
*Date: 2025-10-17*
