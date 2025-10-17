# Security & Protection Strategy

**Date**: 2025-10-17 (Recreated)
**Status**: Phase 7 Planned - Pre-commercial release

---

## Overview

If this IDE is commercialized, we need **multi-layer protection** to prevent unauthorized use and code theft.

**Key Principle**: Security through depth, not obscurity alone.

---

## Protection Layers

```
Layer 1: Legal         → Copyright, License, Terms
Layer 2: Obfuscation   → Code obfuscation, minification
Layer 3: Licensing     → Key validation, activation
Layer 4: Runtime       → Integrity checks, anti-debugging
Layer 5: Distribution  → Code signing, encrypted updates
```

---

## Layer 1: Legal Protection

### Copyright

```
Copyright © 2025 [Your Name/Company]
All Rights Reserved.
```

**Where to Add**:
- Every source file header
- README
- About dialog
- Package.json

### License File

**Option A: Proprietary (Recommended for Commercial)**

```
PROPRIETARY SOFTWARE LICENSE AGREEMENT

This software and its source code are the exclusive property of
[Company Name]. Unauthorized copying, distribution, decompilation,
reverse engineering, or modification is strictly prohibited.

Licensed users are granted the right to:
- Install on authorized devices only
- Use for permitted purposes
- Receive updates during license period

Licensed users may NOT:
- Share license keys
- Redistribute the software
- Reverse engineer or modify
- Remove copyright notices
```

**Option B: Dual License (Open Core)**

```
- Core: MIT/Apache 2.0 (open source)
- Pro Features: Proprietary (paid)
```

### Terms of Service

```
- User data handling
- API usage limits
- Acceptable use policy
- Liability limitations
- Dispute resolution
```

---

## Layer 2: Code Obfuscation

### JavaScript Obfuscation

**Tool**: `javascript-obfuscator`

```bash
npm install --save-dev javascript-obfuscator
```

**Configuration**:

```javascript
// obfuscate.config.js
module.exports = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: true,
  debugProtectionInterval: 2000,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
}
```

**Build Script**:

```json
{
  "scripts": {
    "build:obfuscate": "javascript-obfuscator dist/main.js --output dist/main.obfuscated.js --config obfuscate.config.js"
  }
}
```

### What Gets Obfuscated

**Before**:
```javascript
function validateLicense(key) {
  const parts = key.split('-');
  if (parts.length !== 4) return false;
  return checksum(parts) === parts[3];
}
```

**After**:
```javascript
var _0x4a2b=['split','length','checksum'];(function(_0x2d8f05,_0x4b81bb){var _0x4d74cb=function(_0x32719f){while(--_0x32719f){_0x2d8f05['push'](_0x2d8f05['shift']());}};_0x4d74cb(++_0x4b81bb);}(_0x4a2b,0x1f4));var _0x4d74=function(_0x2d8f05,_0x4b81bb){_0x2d8f05=_0x2d8f05-0x0;var _0x4d74cb=_0x4a2b[_0x2d8f05];return _0x4d74cb;};function _0x32719f(_0x2d8f05){var _0x4b81bb=_0x2d8f05[_0x4d74('0x0')]('-');if(_0x4b81bb[_0x4d74('0x1')]!==0x4)return![];return window[_0x4d74('0x2')](_0x4b81bb)===_0x4b81bb[0x3];}
```

**Caution**: Obfuscation is NOT encryption. Determined attackers can still reverse engineer.

---

## Layer 3: Licensing System

### License Key Format

```
XXXX-XXXX-XXXX-XXXX

Example: A3F9-B2D1-C4E8-7K5M
```

**Components**:
- Part 1: Product ID (4 chars)
- Part 2: License Type (4 chars)
- Part 3: Hardware Hash (4 chars)
- Part 4: Checksum (4 chars)

### License Types

```typescript
enum LicenseType {
  TRIAL = 'TRIAL',      // 14-day trial
  PERSONAL = 'PERSONAL', // Single user
  TEAM = 'TEAM',        // 5 users
  ENTERPRISE = 'ENTERPRISE' // Unlimited
}

interface License {
  key: string
  type: LicenseType
  email: string
  issuedAt: Date
  expiresAt?: Date
  hardwareId?: string
  maxActivations: number
  currentActivations: number
}
```

### Hardware Fingerprinting

```typescript
import { machineIdSync } from 'node-machine-id'

function getHardwareId(): string {
  const id = machineIdSync({ original: true })
  return crypto.createHash('sha256').update(id).digest('hex').substring(0, 8)
}
```

**Binds license to specific machine**.

### Online Activation

```typescript
async function activateLicense(key: string): Promise<boolean> {
  const hardwareId = getHardwareId()

  const response = await fetch('https://api.yourservice.com/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, hardwareId })
  })

  const data = await response.json()

  if (data.valid) {
    // Store license locally
    await storeLicense(key, data.license)
    return true
  }

  return false
}
```

### Offline Grace Period

```typescript
interface StoredLicense {
  key: string
  lastValidated: Date
  offlineGraceDays: number // 7 days
}

function isLicenseValid(license: StoredLicense): boolean {
  const daysSinceValidation = (Date.now() - license.lastValidated.getTime()) / (1000 * 60 * 60 * 24)

  if (daysSinceValidation > license.offlineGraceDays) {
    // Require online validation
    return false
  }

  return true
}
```

**Allows 7 days offline, then requires internet check**.

### License Validation Server

```typescript
// Backend API
app.post('/activate', async (req, res) => {
  const { key, hardwareId } = req.body

  // Check database
  const license = await db.licenses.findOne({ key })

  if (!license) {
    return res.json({ valid: false, error: 'Invalid key' })
  }

  if (license.currentActivations >= license.maxActivations) {
    return res.json({ valid: false, error: 'Activation limit reached' })
  }

  // Check hardware binding
  if (license.hardwareId && license.hardwareId !== hardwareId) {
    return res.json({ valid: false, error: 'Key bound to different machine' })
  }

  // Bind to hardware if first activation
  if (!license.hardwareId) {
    await db.licenses.update({ key }, { hardwareId, currentActivations: license.currentActivations + 1 })
  }

  // Log activation
  await db.activations.create({
    licenseKey: key,
    hardwareId,
    timestamp: new Date(),
    ip: req.ip
  })

  res.json({ valid: true, license })
})
```

---

## Layer 4: Runtime Protection

### Integrity Checks

```typescript
import crypto from 'crypto'
import fs from 'fs'

function verifyIntegrity(): boolean {
  // Hash of critical files stored at build time
  const expectedHashes = {
    'main.js': 'abc123...',
    'preload.js': 'def456...',
  }

  for (const [file, expectedHash] of Object.entries(expectedHashes)) {
    const content = fs.readFileSync(path.join(__dirname, file))
    const actualHash = crypto.createHash('sha256').update(content).digest('hex')

    if (actualHash !== expectedHash) {
      console.error(`Integrity check failed for ${file}`)
      process.exit(1)
    }
  }

  return true
}
```

**Detects file tampering**.

### Anti-Debugging

```typescript
// Detect DevTools
function isDebuggerAttached(): boolean {
  const start = Date.now()
  debugger // This line will pause if debugger attached
  const end = Date.now()

  return end - start > 100 // If >100ms, debugger likely present
}

setInterval(() => {
  if (isDebuggerAttached()) {
    console.log('Debugger detected. Exiting...')
    process.exit(1)
  }
}, 5000)
```

**Note**: This is easily bypassed. Only deters casual attempts.

### Time Bomb (Trial Licenses)

```typescript
function checkTrialExpiration(license: License): boolean {
  if (license.type === LicenseType.TRIAL) {
    const now = Date.now()
    const issued = license.issuedAt.getTime()
    const daysSinceIssued = (now - issued) / (1000 * 60 * 60 * 24)

    if (daysSinceIssued > 14) {
      showTrialExpiredDialog()
      return false
    }
  }

  return true
}
```

---

## Layer 5: Distribution & Updates

### Code Signing

**macOS**:
```bash
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" YourApp.app
```

**Windows**:
```bash
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com YourApp.exe
```

**Prevents OS warnings and verifies authenticity**.

### Encrypted Updates

```typescript
// electron-builder auto-update config
{
  "publish": {
    "provider": "github",
    "owner": "yourname",
    "repo": "yourapp"
  },
  "autoUpdater": {
    "verifyUpdateCodeSignature": true
  }
}
```

### Update Server

```typescript
// Check for updates
autoUpdater.checkForUpdates()

// Download only if license valid
autoUpdater.on('update-available', async (info) => {
  const isValid = await validateLicense()
  if (isValid) {
    autoUpdater.downloadUpdate()
  }
})
```

**Ensures only licensed users get updates**.

---

## Secure Storage

### API Keys

```typescript
import keytar from 'keytar'

// Store securely in OS keychain
await keytar.setPassword('ai-ide', 'anthropic-api-key', apiKey)

// Retrieve
const apiKey = await keytar.getPassword('ai-ide', 'anthropic-api-key')
```

**Uses OS-level encryption** (Keychain on macOS, Credential Manager on Windows).

### License Data

```typescript
import { safeStorage } from 'electron'

// Encrypt license before storing
const encrypted = safeStorage.encryptString(JSON.stringify(license))
fs.writeFileSync(licensePath, encrypted)

// Decrypt when reading
const encrypted = fs.readFileSync(licensePath)
const decrypted = safeStorage.decryptString(encrypted)
const license = JSON.parse(decrypted)
```

---

## Business Model Considerations

### Model 1: Subscription

```
$20/month or $200/year
- Monthly license check
- Cloud-based validation
- Cancel anytime
```

**Pros**: Recurring revenue
**Cons**: Requires internet

### Model 2: Perpetual License

```
$299 one-time
- License key activation
- Lifetime updates (optional: 1 year)
- Offline grace period
```

**Pros**: User preference
**Cons**: No recurring revenue

### Model 3: Open Core

```
Core: Free & Open Source
Pro: $50/month
- Advanced AI models
- Multi-agent system
- Priority support
- Cloud sync
```

**Pros**: Community + revenue
**Cons**: Complex to maintain

### Model 4: Enterprise

```
Contact for pricing
- Volume licensing
- On-premise deployment
- Custom features
- SLA support
```

**Pros**: High value deals
**Cons**: Sales overhead

**Recommendation**: Start with **Perpetual License** (simple), consider **Subscription** later.

---

## Implementation Checklist

### Phase 7A: Legal

- [ ] Copyright notices in all files
- [ ] LICENSE file
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] EULA dialog on first launch

### Phase 7B: Obfuscation

- [ ] Install javascript-obfuscator
- [ ] Configure obfuscation settings
- [ ] Test obfuscated build
- [ ] Integrate into build pipeline

### Phase 7C: Licensing

- [ ] Design license key format
- [ ] Implement hardware fingerprinting
- [ ] Build license validation server
- [ ] Online activation flow
- [ ] Offline grace period
- [ ] Trial mode (14 days)

### Phase 7D: Runtime Protection

- [ ] Integrity checks
- [ ] Anti-debugging (optional)
- [ ] License validation at startup
- [ ] Periodic re-validation
- [ ] Graceful degradation

### Phase 7E: Distribution

- [ ] Code signing certificates
- [ ] Sign macOS .app
- [ ] Sign Windows .exe
- [ ] Auto-update server
- [ ] License-gated updates
- [ ] Installer with EULA

---

## Compliance & Legal

### GDPR (EU)

- Store minimal personal data
- Allow users to export/delete data
- Secure license database
- Privacy policy

### CCPA (California)

- Disclose data collection
- Allow opt-out
- Data access requests

### Export Controls

- Check if encryption features require export license
- Add necessary disclaimers

---

## Attack Scenarios & Mitigations

### Attack 1: Key Sharing

**Attack**: User shares license key with friends

**Mitigation**:
- Hardware fingerprinting
- Max activation limit
- Monitor activations from different IPs

### Attack 2: Cracked Builds

**Attack**: Remove license checks from code

**Mitigation**:
- Obfuscation (delays cracking)
- Integrity checks
- Online validation (can't be removed)
- Regular updates with new protection

### Attack 3: API Key Theft

**Attack**: Extract Anthropic API key from app

**Mitigation**:
- Use user's own API key (best)
- If providing key, use backend proxy
- Rate limiting per user

### Attack 4: Reverse Engineering

**Attack**: Decompile to understand protection

**Mitigation**:
- Obfuscation
- Code signing (detects modifications)
- Anti-debugging
- Accept that determined attackers will succeed

---

## Monitoring & Analytics

### Track (Anonymously)

- License activations
- Feature usage
- Error rates
- Update adoption

### Detect Abuse

- Same key activated 100+ times → Flag
- Rapid activation/deactivation → Flag
- API usage patterns → Detect proxying

### Dashboard

```
Total Active Licenses: 1,234
├─ Trial: 234
├─ Personal: 800
├─ Team: 150
└─ Enterprise: 50

Recent Activations: 45 (last 7 days)
Flagged Keys: 3 (review needed)
```

---

## Open Source Considerations

### If Going Open Source

**Challenges**:
- Code visible → Protection harder
- Anyone can build from source
- License checks can be removed

**Solutions**:

1. **Open Core Model**:
   - Core features: MIT license (free)
   - Pro features: Proprietary (paid)
   - Pro features compiled separately

2. **SaaS Model**:
   - Free local app
   - Paid cloud features (sync, AI credits)

3. **Support & Services**:
   - Software free
   - Charge for support, hosting, consulting

**Recommendation**: If open source, use **Open Core** or **SaaS** model.

---

## Cost-Benefit Analysis

### Protection Costs

- Development time: 2-3 weeks
- Code signing certificates: $300/year
- License server hosting: $20-50/month
- Obfuscation tools: Free (open source)
- Legal review: $1,000-5,000

**Total**: ~$2,000-7,000 initial + $500-1,000/year

### Piracy Impact

- Assume 10-20% of users would pirate if trivial
- If 1,000 potential sales at $200 = $200,000 revenue
- 10% piracy = $20,000 loss
- 20% piracy = $40,000 loss

**ROI**: If costs <$10,000, protection worth it.

---

*Last Updated: 2025-10-17*
*Status: Protection strategy defined, implementation in Phase 7*
