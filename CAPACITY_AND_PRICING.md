# IP Scaffold - Capacity Planning & Pricing Strategy

**Document Version:** 1.0
**Last Updated:** January 21, 2026
**Budget Constraint:** $500 maximum hard costs

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Cost Analysis](#cost-analysis)
3. [Capacity Planning](#capacity-planning)
4. [Pricing Strategy](#pricing-strategy)
5. [Alpha Launch Strategy](#alpha-launch-strategy)
6. [Risk Mitigation & Safety Measures](#risk-mitigation--safety-measures)
7. [Recommendations](#recommendations)

---

## Executive Summary

### Key Findings

| Metric | Conservative | Optimistic |
|--------|-------------|------------|
| **Cost per upload** | $4.00 | $2.50 |
| **Free users supported ($500)** | 41 users | 66 users |
| **Break-even paid packs** | 25 packs | 16 packs |
| **Recommended alpha cap** | 30 users | 50 users |

### Critical Numbers

- **Free tier:** 30 credits = 3 uploads per user
- **Paid tier:** $20 for 30 credits (3 more uploads)
- **Cost per upload:** $4.00 (conservative average)
- **Margin per paid pack:** $8.00 (at $4/upload) to $12.50 (at $2.50/upload)

---

## Cost Analysis

### Per-Upload Cost Breakdown

#### 1. PDF Parsing

| Method | Cost | When Used |
|--------|------|-----------|
| pdf-parse (primary) | $0.00 | 70-80% of patents |
| pdf.js fallback | $0.00 | 15-25% of patents |
| Claude API fallback | $0.50-2.00 | 5-10% of complex patents |

**Expected average:** $0.10-0.30 per upload (weighted by fallback frequency)

#### 2. Claude AI Generation (Anthropic)

Using Claude Sonnet 4 (`claude-sonnet-4-20250514`):

| Artifact | Input Tokens | Output Tokens | Est. Cost |
|----------|-------------|---------------|-----------|
| ELIA15 | ~30,000 | ~2,000 | $0.40-0.60 |
| Business Narrative | ~35,000 | ~3,000 | $0.50-0.80 |
| Golden Circle | ~10,000 | ~1,500 | $0.15-0.25 |
| **Subtotal** | - | - | **$1.05-1.65** |

*Pricing based on Claude Sonnet 4: $3/MTok input, $15/MTok output*

#### 3. Image Prompts (Claude Haiku)

| Purpose | Calls | Cost per Call | Total |
|---------|-------|---------------|-------|
| Hero image prompt | 1 | ~$0.001 | $0.001 |
| Section image prompts | 5-8 | ~$0.001 | $0.005-0.008 |
| **Subtotal** | - | - | **~$0.01** |

#### 4. DALL-E 3 Image Generation (OpenAI)

| Image Type | Size | Quality | Cost Each | Count | Total |
|------------|------|---------|-----------|-------|-------|
| Hero image | 1024x1024 | Standard | $0.04 | 1 | $0.04 |
| Section images | 1792x1024 | Standard | $0.04 | 5-8 | $0.20-0.32 |
| **Subtotal** | - | - | - | - | **$0.24-0.36** |

*Note: Code comments mention $0.04 for standard quality*

#### 5. Infrastructure Costs (Fixed Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| Replit hosting | $0-25/mo | Free tier or Hacker plan |
| Supabase | $0-25/mo | Free tier sufficient for alpha |
| Sentry monitoring | $0/mo | Free tier |
| **Total infrastructure** | **$0-50/mo** | Use free tiers for alpha |

### Total Cost Per Upload

| Scenario | PDF | Claude AI | Images | Total |
|----------|-----|-----------|--------|-------|
| **Optimistic** | $0.05 | $1.05 | $0.24 | **$1.34** |
| **Typical** | $0.20 | $1.35 | $0.30 | **$1.85** |
| **Conservative** | $0.50 | $1.65 | $0.36 | **$2.51** |
| **Worst case (Claude PDF)** | $2.00 | $1.65 | $0.36 | **$4.01** |

**Recommended planning cost: $4.00 per upload** (conservative, accounts for variability)

---

## Capacity Planning

### Scenario Analysis Under $500 Budget

#### Scenario 1: All Free Users (No Conversions)

| Metric | Conservative ($4/upload) | Optimistic ($2.50/upload) |
|--------|-------------------------|---------------------------|
| Total uploads possible | 125 | 200 |
| Free uploads per user | 3 | 3 |
| **Max free users** | **41** | **66** |

#### Scenario 2: 10% Conversion Rate

*Assumption: 10% of free users buy 1 paid pack ($20)*

| Metric | Conservative | Optimistic |
|--------|-------------|------------|
| Free users | 50 | 80 |
| Free uploads (50 x 3) | 150 | 240 |
| Paid users (10%) | 5 | 8 |
| Paid uploads (5 x 3) | 15 | 24 |
| **Total uploads** | 165 | 264 |
| **Total cost** | $660 | $660 |
| **Revenue from paid** | $100 | $160 |
| **Net cost** | $560 | $500 |
| **Over budget?** | YES (+$60) | NO |

**Adjusted for $500 budget at 10% conversion:**

| Metric | Conservative | Optimistic |
|--------|-------------|------------|
| **Max free users** | **38** | **66** |
| Paid users | 4 | 7 |
| Revenue | $80 | $140 |
| Total uploads | 126 | 219 |

#### Scenario 3: 25% Conversion Rate

| Metric | Conservative | Optimistic |
|--------|-------------|------------|
| Free users | 50 | 80 |
| Paid users (25%) | 12 | 20 |
| Total uploads | 186 | 300 |
| Total cost | $744 | $750 |
| Revenue | $240 | $400 |
| **Net cost** | **$504** | **$350** |

**At 25% conversion, you can support:**

| Metric | Conservative | Optimistic |
|--------|-------------|------------|
| **Free users** | **49** | **95** |
| Paid users | 12 | 24 |
| Break-even? | Nearly | Profitable |

#### Scenario 4: 50% Conversion Rate

| Metric | Conservative | Optimistic |
|--------|-------------|------------|
| Free users | 50 | 100 |
| Paid users (50%) | 25 | 50 |
| Total uploads | 225 | 450 |
| Total cost | $900 | $1,125 |
| Revenue | $500 | $1,000 |
| **Net cost** | **$400** | **$125** |

**At 50% conversion, you can support:**

| Metric | Conservative | Optimistic |
|--------|-------------|------------|
| **Free users** | **62** | **200+** |
| Net profitable? | Nearly | YES |

### Capacity Summary Table

| Conversion Rate | Free Users (Conservative) | Free Users (Optimistic) | Net Cost |
|-----------------|--------------------------|-------------------------|----------|
| 0% | 41 | 66 | $500 |
| 10% | 38 | 66 | ~$500 |
| 25% | 49 | 95 | ~$400-500 |
| 50% | 62 | 125 | ~$125-400 |

### Break-Even Analysis

**Question: How many paid packs to cover all costs?**

At $4.00 per upload (conservative):
- Cost for 3 uploads = $12.00
- Revenue per pack = $20.00
- **Profit per pack = $8.00**

| Scenario | Total Uploads | Total Cost | Packs to Break Even |
|----------|--------------|------------|---------------------|
| 30 free users (90 uploads) | 90 | $360 | 45 packs ($900) |
| 40 free users (120 uploads) | 120 | $480 | 60 packs ($1,200) |
| 50 free users (150 uploads) | 150 | $600 | 75 packs ($1,500) |

**To break even on the $500 budget:**
- At $4/upload: Need **63 paid packs** ($1,260 revenue) to cover $500 in costs
- At $2.50/upload: Need **42 paid packs** ($840 revenue)

**More realistically - to achieve cost neutrality:**

| Metric | Calculation |
|--------|-------------|
| Cost per pack (3 uploads) | $12.00 (conservative) |
| Revenue per pack | $20.00 |
| Margin per pack | $8.00 |
| To cover $500 | 500 / 8 = **63 packs** |

---

## Pricing Strategy

### Current Pricing Assessment

| Tier | Credits | Uploads | Price | Cost (Conservative) | Margin |
|------|---------|---------|-------|---------------------|--------|
| Free | 30 | 3 | $0 | $12.00 | -$12.00 |
| Paid | 30 | 3 | $20 | $12.00 | +$8.00 |

**Is $20/pack profitable?** YES, with $8.00 margin (40% profit margin)

### Alternative Pricing Models

#### Option A: Volume Discounts

| Pack | Uploads | Price | Per Upload | Margin |
|------|---------|-------|------------|--------|
| Starter | 3 | $20 | $6.67 | $8.00 (40%) |
| Growth | 10 | $50 | $5.00 | $10.00 (20%) |
| Pro | 25 | $100 | $4.00 | $0 (0%) |

**Recommendation:** Offer Growth pack at $50 for 10 uploads
- Still profitable at $10 margin
- Better value proposition for serious users
- Encourages larger purchases

#### Option B: Subscription Model

| Plan | Monthly | Uploads/mo | Per Upload | Break-even Uploads |
|------|---------|------------|------------|-------------------|
| Basic | $29/mo | 5 | $5.80 | 7.25 |
| Pro | $79/mo | 15 | $5.27 | 19.75 |
| Team | $199/mo | 50 | $3.98 | 49.75 |

**Recommendation:** Avoid subscriptions for alpha
- Adds complexity
- Harder to predict costs
- Better to validate demand with pay-as-you-go first

#### Option C: Tiered Credit Pricing (Recommended)

| Pack | Credits | Uploads | Price | Per Upload | Your Cost | Margin |
|------|---------|---------|-------|------------|-----------|--------|
| Trial | 30 | 3 | FREE | $0 | $12.00 | -$12.00 |
| Starter | 30 | 3 | $20 | $6.67 | $12.00 | $8.00 (40%) |
| Value | 100 | 10 | $55 | $5.50 | $40.00 | $15.00 (27%) |
| Bulk | 300 | 30 | $150 | $5.00 | $120.00 | $30.00 (20%) |

### Pricing Recommendations

1. **Keep $20/3-pack** - It's profitable with good margins
2. **Add $55/10-pack** - Better value, encourages commitment
3. **Skip subscriptions** - Too complex for alpha
4. **Consider $15/3-pack** - If you want to be more competitive (still $3 margin)

---

## Alpha Launch Strategy

### Recommended Alpha Caps

| Phase | Duration | Users | Expected Cost | Safety Buffer |
|-------|----------|-------|---------------|---------------|
| Soft Launch | Week 1-2 | 10 | $120 | $380 remaining |
| Limited Alpha | Week 3-4 | 20 | $240 | $260 remaining |
| Open Alpha | Week 5-8 | 30 | $360 | $140 remaining |
| **Total** | 8 weeks | **30** | **$360** | **$140 buffer** |

### Invite Strategy

```
Week 1-2:  Invite 10 trusted testers (friends, colleagues)
           - Gather feedback
           - Test system stability
           - Monitor costs closely

Week 3-4:  Expand to 20 users
           - If costs are tracking low, continue
           - If costs are tracking high, pause

Week 5-8:  Open to 30 users total
           - Enable paid purchases
           - Target 20% conversion
```

### When to Pause Invites

| Trigger | Action |
|---------|--------|
| Spending > $300 | Review conversion rates, consider pausing |
| Spending > $400 | Pause new invites, focus on conversions |
| Spending > $450 | Hard stop on new free users |
| Any day > $50 | Investigate immediately |

### Conversion Rate Targets

| Target | Users | Paid Users | Revenue | Net Cost |
|--------|-------|------------|---------|----------|
| Minimum (10%) | 30 | 3 | $60 | $300 |
| Target (20%) | 30 | 6 | $120 | $240 |
| Stretch (30%) | 30 | 9 | $180 | $180 |

---

## Risk Mitigation & Safety Measures

### 1. API Spending Limits

#### OpenAI (DALL-E)

```
Dashboard: https://platform.openai.com/account/limits

Recommended settings:
- Monthly limit: $200
- Notification threshold: $150
- Enable email alerts
```

#### Anthropic (Claude)

```
Dashboard: https://console.anthropic.com/settings/limits

Recommended settings:
- Monthly limit: $300
- Notification threshold: $200
- Enable email + webhook alerts
```

### 2. Alerting Thresholds

| Level | Spent | Action |
|-------|-------|--------|
| INFO | $100 | Log to monitoring |
| WARNING | $200 | Email notification |
| ALERT | $300 | Slack/SMS notification |
| CRITICAL | $400 | Auto-disable new signups |
| EMERGENCY | $450 | Auto-disable uploads |

### 3. Implement Cost Tracking

Add to your application:

```typescript
// Track costs per upload
interface UploadCost {
  pdf_parsing: number;
  claude_elia15: number;
  claude_business: number;
  claude_golden: number;
  dalle_hero: number;
  dalle_sections: number;
  total: number;
}

// Log to database for monitoring
async function logUploadCost(patentId: string, costs: UploadCost) {
  await supabaseAdmin.from('upload_costs').insert({
    patent_id: patentId,
    ...costs,
    created_at: new Date().toISOString()
  });
}
```

### 4. Emergency Brake Mechanisms

#### Feature Flags

```typescript
// In your config or environment
const FEATURE_FLAGS = {
  ALLOW_NEW_SIGNUPS: true,        // Disable at $400 spent
  ALLOW_FREE_UPLOADS: true,       // Disable at $450 spent
  ALLOW_PAID_UPLOADS: true,       // Keep enabled unless critical
  GENERATE_IMAGES: true,          // Can disable to reduce costs by ~$0.30/upload
  USE_CLAUDE_PDF_FALLBACK: true,  // Can disable to cap PDF costs at $0
};
```

#### Circuit Breaker Pattern

```typescript
// Auto-disable if too many failures or excessive costs
const circuitBreaker = {
  failureThreshold: 5,      // Consecutive failures to trip
  costThreshold: 50,        // Single day cost to trip
  cooldownMinutes: 30,      // How long to stay tripped
};
```

### 5. Cost Reduction Options (If Needed)

| Option | Savings | Impact |
|--------|---------|--------|
| Disable section images | ~$0.30/upload | Lower visual appeal |
| Use Claude Haiku for artifacts | ~$0.80/upload | Lower quality output |
| Disable Claude PDF fallback | ~$0.20/upload avg | Some PDFs will fail |
| Reduce sections per artifact | ~$0.15/upload | Less comprehensive |

### 6. Daily Monitoring Checklist

```
[ ] Check Anthropic dashboard for spend
[ ] Check OpenAI dashboard for spend
[ ] Review upload count vs. projections
[ ] Check error rates (failed uploads)
[ ] Review conversion rate
[ ] Check remaining budget
```

---

## Recommendations

### Summary of Key Actions

#### Immediate (Before Launch)

1. **Set API spending limits:**
   - OpenAI: $200/month hard limit
   - Anthropic: $300/month hard limit

2. **Configure alerts:**
   - Email at $200 total
   - SMS/Slack at $350 total

3. **Start with 10 users:**
   - Validate costs match projections
   - Test system under real load

#### Week 1-2

4. **Monitor actual costs:**
   - Track cost per upload
   - Compare to $4.00 conservative estimate
   - Adjust projections if needed

5. **Enable paid tier:**
   - Keep $20/3-pack pricing
   - Consider adding $55/10-pack

#### Week 3-8

6. **Scale cautiously:**
   - Add 5 users per week if costs are on track
   - Target 30 users by week 8
   - Maintain $140 safety buffer

### Decision Matrix

| If... | Then... |
|-------|---------|
| Cost/upload < $2.50 | Increase user cap, consider lower pricing |
| Cost/upload $2.50-$4.00 | Proceed as planned |
| Cost/upload > $4.00 | Investigate causes, reduce image count |
| Conversion < 10% | Improve onboarding, add incentives |
| Conversion > 25% | Consider expanding faster |
| Daily spend > $50 | Pause and investigate |

### Final Budget Allocation

| Category | Amount | Purpose |
|----------|--------|---------|
| Free user costs | $360 | 30 users x 3 uploads x $4 |
| Safety buffer | $100 | For unexpected costs |
| Infrastructure | $40 | Replit/Supabase overages |
| **Total** | **$500** | |

---

## Appendix: Quick Reference

### Key Numbers

| Metric | Value |
|--------|-------|
| Cost per upload (conservative) | $4.00 |
| Cost per upload (optimistic) | $2.50 |
| Free tier uploads | 3 |
| Paid pack uploads | 3 |
| Paid pack price | $20 |
| Margin per paid pack | $8.00 |
| Max free users ($500) | 41 |
| Recommended alpha cap | 30 |
| Safety buffer | $140 |

### API Limits to Set

| Service | Monthly Limit | Alert Threshold |
|---------|--------------|-----------------|
| OpenAI | $200 | $150 |
| Anthropic | $300 | $200 |

### Alert Thresholds

| Spent | Action |
|-------|--------|
| $200 | Email alert |
| $300 | Slack alert |
| $400 | Pause new signups |
| $450 | Pause all uploads |

---

*This document should be reviewed and updated weekly during the alpha period.*
