# Autonomous Coordination Test Scenarios

> **Test Repos**: `test-frontend` and `test-backend`
>
> **Goal**: Demonstrate autonomous agent coordination across repositories

---

## Scenario 1: Building a User API (Simple Cross-Repo Task)

### Setup
1. Open project-ka application
2. Add both repositories:
   - `/Users/sandeep/GIT/test-backend`
   - `/Users/sandeep/GIT/test-frontend`

### Test Steps

**Step 1: Ask Backend Agent to Create User API**

Go to **test-backend** agent tab and ask:
```
Create a simple Express.js API with a GET /api/users endpoint that returns
a list of sample users (id, name, email). Include CORS support.
```

**Expected Agent Behavior:**
- Agent autonomously reads current `index.js`
- Realizes it needs to add Express.js
- Creates API with CORS
- **Should NOT** post to bridge (has all info needed)

**Expected Result:**
```javascript
// index.js
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' }
  ]);
});

app.listen(3001, () => {
  console.log('Backend running on http://localhost:3001');
});
```

---

**Step 2: Ask Frontend Agent to Fetch Users**

Go to **test-frontend** agent tab and ask:
```
Create a React component that fetches and displays users from our backend API.
Use the /api/users endpoint.
```

**Expected Agent Behavior (WITHOUT coordination - will fail):**
- Agent reads `app.js`
- **PROBLEM**: Agent doesn't know what port the backend is running on!
- **PROBLEM**: Agent doesn't know the exact endpoint structure!
- Agent might make assumptions or ask user

**This is where coordination should kick in!**

---

**Step 3: Ask Frontend Agent WITH Coordination Hint**

Go to **test-frontend** agent tab and ask:
```
Create a React component that fetches and displays users from our backend API.
If you need information about the backend API, coordinate with the backend agent.
```

**Expected Agent Behavior (WITH autonomous coordination):**

1. **Frontend Agent realizes it needs info:**
   - Doesn't know backend URL
   - Doesn't know exact API response structure

2. **Frontend Agent posts to bridge:**
   ```
   Tool: post_to_bridge
   Message: "@test-backend agent - What is the URL and response format for the users endpoint? I need to fetch users in the frontend."
   Type: question
   ```

3. **Bridge shows the message:**
   - Check the Bridge tab to see the question posted

4. **Backend Agent (in next message) should respond:**
   When you go to **test-backend** agent tab next time and send any message,
   it will see the bridge message in its system prompt and might respond!

---

## Scenario 2: Debugging Cross-Repo CORS Issue

### Test Steps

**Step 1: Frontend Agent Reports Error**

Ask **test-frontend** agent:
```
I'm getting a CORS error when fetching from the backend. Can you help debug?
```

**Expected Agent Behavior:**
1. Frontend agent checks its fetch code
2. Realizes CORS is a backend configuration issue
3. **Posts to bridge:**
   ```
   Tool: post_to_bridge
   Message: "@test-backend - Frontend is getting CORS errors. Can you check if CORS is properly configured in the backend?"
   Type: question
   ```

**Step 2: Backend Agent Responds**

Go to **test-backend** agent tab and send:
```
Check if there are any issues reported by other agents
```

**Expected Agent Behavior:**
1. Backend agent sees frontend's question in system prompt
2. Reads backend code
3. Checks CORS configuration
4. **Posts to bridge:**
   ```
   Tool: post_to_bridge
   Message: "@test-frontend - CORS is configured. Make sure you're using the correct origin. Backend is on port 3001."
   Type: info
   ```

---

## Scenario 3: Feature Development with Task Distribution

### Test Steps

**Step 1: Ask Bridge to Coordinate Feature**

Go to **Bridge** tab and ask:
```
I want to add user authentication to our app. Backend needs JWT auth,
frontend needs login form and token storage. Can you coordinate this
between the agents?
```

**Expected Bridge Behavior:**
1. Bridge analyzes the task
2. Suggests splitting work:
   - Backend: JWT middleware, login endpoint, token generation
   - Frontend: Login form, token storage, auth header
3. Bridge might suggest agents post updates to coordinate

**Step 2: Agents Work and Coordinate**

The Bridge should guide you to:
1. Tell **backend agent** to implement JWT auth
2. Tell **frontend agent** to implement login form

As they work, they should:
- **Backend agent posts:** "JWT auth implemented. Login endpoint is POST /api/auth/login, expects {email, password}, returns {token}"
- **Frontend agent sees this** in next interaction and uses correct endpoint

---

## Scenario 4: Testing Autonomous Status Updates

### Test Steps

**Step 1: Give Backend Agent a Multi-Step Task**

Ask **test-backend** agent:
```
Add the following features to the backend:
1. User registration endpoint (POST /api/auth/register)
2. Login endpoint (POST /api/auth/login)
3. JWT middleware for protected routes
4. Update GET /api/users to be a protected route

Post status updates to the bridge as you complete each step.
```

**Expected Agent Behavior:**
1. Agent works on task 1
2. **Posts to bridge:** "Completed user registration endpoint"
3. Agent works on task 2
4. **Posts to bridge:** "Completed login endpoint with JWT generation"
5. And so on...

**Monitor the Bridge tab** to see these status updates appearing in real-time!

---

## Scenario 5: Agent Asking for Help When Stuck

### Test Steps

**Step 1: Give Frontend Agent an Ambiguous Task**

Ask **test-frontend** agent:
```
Integrate the user authentication flow with the backend
```

**Expected Agent Behavior:**
1. Agent analyzes task
2. Realizes it's missing information:
   - What are the auth endpoints?
   - What's the token format?
   - Where to store the token?
3. **Posts to bridge:**
   ```
   Tool: post_to_bridge
   Message: "@test-backend - I need to implement authentication on the frontend. What auth endpoints are available and what's the expected request/response format?"
   Type: question
   ```

---

## How to Observe Coordination

### 1. Bridge Tab
- Go to the **Bridge** tab
- Watch for messages posted by agents
- Format: `[Agent name]: message content`

### 2. Agent System Prompts
When you interact with an agent, recent bridge messages appear in their context.
To verify this:
1. Agent A posts to bridge
2. Go to Agent B tab
3. Send any message
4. Agent B's response should show awareness of Agent A's message

### 3. Tool Execution Indicators
Watch for:
- 🔧 Executing: post_to_bridge
- ✅ Complete: post_to_bridge
- 📢 Posted to Bridge: [message preview]

---

## Testing Checklist

- [ ] **Test 1**: Backend agent creates API (no coordination needed)
- [ ] **Test 2**: Frontend agent asks backend for API details
- [ ] **Test 3**: Frontend reports CORS issue, backend responds
- [ ] **Test 4**: Bridge coordinates multi-agent feature development
- [ ] **Test 5**: Backend agent posts status updates
- [ ] **Test 6**: Frontend agent asks for help when stuck

**Success Criteria:**
- ✅ Agents autonomously post to bridge when they need info
- ✅ Agents see and respond to bridge messages
- ✅ Bridge shows all agent communications
- ✅ No manual copy-paste needed between agents

---

## Expected Coordination Patterns

### Pattern 1: Question & Answer
```
Frontend: "@backend - What's the API endpoint for users?"
Backend: "@frontend - GET /api/users on port 3001"
```

### Pattern 2: Status Updates
```
Backend: "Completed user registration endpoint"
Backend: "Completed login endpoint"
Backend: "All auth features done"
```

### Pattern 3: Problem Reporting
```
Frontend: "@backend - Getting CORS errors"
Backend: "@frontend - CORS configured, check your origin"
```

### Pattern 4: Information Sharing
```
Backend: "FYI - Changed API port from 3001 to 4000"
Frontend: "Thanks! Updating fetch URLs"
```

---

## Troubleshooting

**If agents don't coordinate autonomously:**

1. **Be explicit in your prompt:**
   - ✅ "If you need info from backend, ask via bridge"
   - ✅ "Post status updates to bridge"
   - ❌ "Build the feature" (too vague)

2. **Check Bridge tab:**
   - Messages should appear when agents use `post_to_bridge`
   - If empty, agents haven't posted yet

3. **Give agents context:**
   - "You're working with other agents on this project"
   - "Coordinate via the bridge when needed"

4. **Use explicit mentions:**
   - Ask agents to "@mention other-agent-name"
   - This makes intent clearer

---

## Advanced Test: Fully Autonomous Workflow

**Ultimate Test:**

1. Go to **Bridge** tab
2. Ask:
   ```
   Build a complete user management system:
   - Backend: CRUD API for users with JWT auth
   - Frontend: Login, registration, and user list pages

   Coordinate between backend and frontend agents to complete this.
   Split the work appropriately and have agents communicate via bridge.
   ```

3. **Let the Bridge coordinate:**
   - Bridge should assign tasks to each agent
   - Tell backend agent to start
   - Tell frontend agent to wait for backend endpoints
   - Monitor bridge for cross-agent communication

**Success = Minimal user intervention, agents coordinate autonomously!** 🎉
