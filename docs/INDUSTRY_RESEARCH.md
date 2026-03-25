# Film Budgeting Industry Research

**Date:** 2026-03-24
**Purpose:** Competitive analysis and feature gap identification for mBT

---

## 1. Film Budgeting Standards (Wikipedia)

### Budget Structure
A film budget is typically divided into **four sections**:

1. **Above the Line (ATL)** - Creative talent
   - Story rights (play, novel, video game, remake, sequel)
   - Screenplay ($69,499 - $5M for WGA members)
   - Producers (seven-figure salaries + profit participation)
   - Director (DGA minimum $19,143/week, A-list $5-10M)
   - Cast (Guild rate ~$2,300/week, stars up to $30M)

2. **Below the Line (BTL)** - Direct production costs
   - Crew wages
   - Production design
   - Live set and studio costs
   - Costumes
   - Catering (food services)

3. **Post-Production**
   - Editing
   - Visual effects
   - Sound design
   - Music composition

4. **Other**
   - Insurance
   - Completion bond
   - Legal fees

### Key Financial Concepts

**Gross Budget vs Net Budget:**
- **Gross Budget** = Total actual spending to produce the project
- **Net Budget** = Final out-of-pocket after government incentives/rebates

**Example:** Sony's *Pixels* (2015)
- Gross budget: $129.6 million
- Net budget: $111 million (after $18 million Canadian rebate)

**Important:** The gross budget represents the true cost of production. Net budget only reflects the producer's final out-of-pocket expense.

---

## 2. Tax Credits & Incentives (StudioBinder)

### Why States Offer Tax Credits
- Stimulate state economy through film production
- Create jobs and increase local business revenue
- Tourism potential from filming locations
- Debate exists on whether programs actually work

### Types of Film Tax Credits

| Type | Description |
|------|-------------|
| **Movie Production Incentives** | Catch-all term for state programs |
| **Film Tax Credits** | Cover portion of income tax owed |
| **Cash Rebates** | Percentage of spending distributed after shoot |
| **Grants** | Given before production starts |
| **Sales Tax Exemptions** | Cover portion of in-state spending |
| **Lodging Exemptions** | Cover hotel spending taxes (30+ days) |
| **Fee-Free Locations** | State-owned locales at no charge |

### State Programs

**California:**
- 20% tax credit on feature films ($1-75M budget)
- 25% tax credit for TV series moving production to CA
- Miniseries: $500,000 minimum budget

**Other States with Programs:**
- Louisiana
- New York
- Massachusetts
- Georgia
- New Mexico
- (Many others)

---

## 3. Competitor Analysis

### Movie Magic Budgeting ($479)
**Strengths:**
- Industry standard for 20+ years
- Used by majority of Hollywood productions
- Free training classes available
- Automatic fringe calculations
- Tax credit application support
- Universal compatibility (share with any producer/studio)

**Weaknesses:**
- Windows-only
- Requires Java
- Crashes frequently ("save often" is standard advice)
- Difficult to read on high-resolution monitors
- Only 6 updates in 20 years
- $479 price tag

### Wrapbook (Subscription)
**Strengths:**
- AI-powered payroll + accounting
- Real-time financial visibility
- Expert union paymasters
- Mobile timecards
- Smart startwork/onboarding
- Custom approval flows
- AI-powered invoice processing
- Universal vendor management
- One-click reporting
- ERP integrations

**Weaknesses:**
- Cloud-only (requires internet)
- Subscription-based pricing
- Payroll focus (not budgeting)
- Expensive for small productions

### StudioBinder (Subscription)
**Strengths:**
- Production management suite
- Call sheets, shot lists, schedules
- Free budget templates (Google Sheets)
- Modern UI

**Weaknesses:**
- Cloud-only
- Budgeting is light (templates only)
- Generic (not film-specific budgeting)
- Subscription required

### Celtx ($10-30/month)
**Strengths:**
- Industry-standard screenwriting
- Story development tools (beat sheets, storyboards)
- Pre-production planning (breakdowns, scheduling)
- Real-time collaboration
- 7 million users in 140+ countries

**Weaknesses:**
- Budgeting is an add-on (not core feature)
- Subscription-based
- Cloud-only
- Budget features are basic

**Celtx Pricing:**
- Free: 1 project
- Writer Pro: Unlimited projects + story development
- Team: 3-15 members + production planning
- Education: Bulk seats for schools

---

## 4. Feature Gap Analysis

### What mBT HAS (Competitive Advantages)
| Feature | mBT | Movie Magic | Wrapbook | StudioBinder | Celtx |
|---------|-----|-------------|----------|--------------|-------|
| **Price** | FREE | $479 | Subscription | Subscription | Subscription |
| **Offline** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Multiplayer** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Cross-Platform** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **AI Integration** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Modern Tech** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Data Ownership** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Union Rates** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Fringes** | ✅ | ✅ | ✅ | ❌ | ❌ |

### Potential Feature Gaps

| Gap | Priority | Rationale |
|-----|----------|-----------|
| **Tax Credit Calculator** | HIGH | Movie Magic's killer feature. Producers need this for grants/incentives. |
| **Gross vs Net Budget** | HIGH | Industry-standard terminology. Shows true cost vs out-of-pocket. |
| **Budget vs Actual Reporting** | MEDIUM | Track planned vs spent. Wrapbook has this. |
| **Completion Bond Tracking** | MEDIUM | Standard "Other" category in film budgets. |
| **Story Rights Tracking** | LOW | First ATL line item. Nice-to-have. |
| **Payroll Integration** | LOW | Wrapbook's domain. Could partner instead of build. |

---

## 5. Market Positioning

### mBT's Unique Value Proposition
**"Professional film budgeting that works offline, costs nothing, and lets your whole team collaborate in real-time."**

### Target Segments
1. **Independent filmmakers** - Can't afford $479 or subscriptions
2. **Remote productions** - Need offline access on location
3. **International crews** - Work across time zones
4. **Film schools** - Free tool for students
5. **Small production companies** - Professional features without enterprise cost

### Competitive Moat
1. **Free + Professional** - No other tool offers this combination
2. **Offline-first PWA** - Works anywhere, no server required
3. **Modern tech stack** - WASM, OPFS, PWA vs legacy Java
4. **Film-specific** - OpenGate rates, union fringes built-in
5. **Data sovereignty** - Your data stays on your device

---

## 6. Recommendations

### High-Value Additions
1. **Tax Credit Calculator**
   - Input: State/country, budget amount, qualifying expenses
   - Output: Estimated credit/rebate amount
   - Impact: Closes biggest gap vs Movie Magic

2. **Gross vs Net Budget Display**
   - Show both gross and net totals
   - Track incentives/rebates separately
   - Impact: Industry-standard terminology

3. **Budget vs Actual Tracking**
   - Import actual expenses
   - Variance reporting
   - Impact: Competes with Wrapbook's accounting features

### Strategic Considerations
- **Don't build payroll** - Partner with Wrapbook or similar
- **Don't build screenwriting** - Celtx owns this space
- **Focus on budgeting depth** - This is mBT's core strength
- **Maintain offline-first** - Key differentiator vs cloud tools

---

## Sources
- Wikipedia: Film budgeting
- StudioBinder: Film tax credits article
- StudioBinder: Best film budgeting software article
- Celtx.com: Product and pricing pages
- Wrapbook.com: Product features
- Movie Magic Budgeting: Industry reputation and reviews