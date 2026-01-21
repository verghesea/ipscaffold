# Alpha Launch Checklist - IP Scaffold

**Version:** 1.0
**Date:** January 21, 2026
**Target:** 5-10 Alpha Testers

---

## Pre-Launch Summary

| Category | Status | Details |
|----------|--------|---------|
| BLOCKER Issues | FIXED | Rate limiting, credit check |
| HIGH Issues | FIXED | Magic link rate limit, error handler, error boundary |
| Monitoring | READY | Sentry + PostHog configured |
| Testing | READY | Unit, integration, E2E tests created |
| Credits | SET | 30 credits default (3 uploads) |

---

## T-3 Days: Monitoring Setup

### Sentry (Error Monitoring)

- [ ] **Create Sentry Account**
  - Go to [sentry.io](https://sentry.io)
  - Sign up with GitHub
  - Create organization

- [ ] **Create Server Project**
  - Platform: Node.js / Express
  - Copy DSN

- [ ] **Create Client Project**
  - Platform: React
  - Copy DSN

- [ ] **Add Secrets to Replit**
  ```
  SENTRY_DSN=https://xxx@sentry.io/xxx           (server)
  VITE_SENTRY_DSN=https://xxx@sentry.io/xxx      (client)
  ```

- [ ] **Verify Sentry Integration**
  - Deploy to Replit
  - Check console for "[Sentry] Initialized"
  - Trigger a test error
  - Verify error appears in Sentry dashboard

### PostHog (Analytics)

- [ ] **Create PostHog Account**
  - Go to [posthog.com](https://posthog.com)
  - Sign up with GitHub
  - Create project

- [ ] **Copy API Key**

- [ ] **Add Secrets to Replit**
  ```
  VITE_POSTHOG_KEY=phc_xxx
  VITE_POSTHOG_HOST=https://app.posthog.com
  ```

- [ ] **Verify PostHog Integration**
  - Deploy to Replit
  - Visit the app
  - Check PostHog dashboard for events

### UptimeRobot (Uptime Monitoring)

- [ ] **Create UptimeRobot Account**
  - Go to [uptimerobot.com](https://uptimerobot.com)
  - Sign up free

- [ ] **Add Health Monitor**
  - Type: HTTP(s)
  - URL: `https://your-app.replit.app/api/ping`
  - Interval: 5 minutes

- [ ] **Configure Alerts**
  - Add email contact
  - Test alert delivery

---

## T-2 Days: Final Code Verification

### Run Tests Locally

- [ ] **Install Dependencies**
  ```bash
  npm install
  ```

- [ ] **Run Unit Tests**
  ```bash
  npm test
  ```
  - All tests should pass
  - Review any failures

- [ ] **Run TypeScript Check**
  ```bash
  npm run check
  ```
  - No type errors

- [ ] **Run Build**
  ```bash
  npm run build
  ```
  - Build succeeds

### Verify Fixes

- [ ] **HIGH-1: Magic Link Rate Limiting**
  - Send 4 magic link requests rapidly
  - 4th should return 429
  - Wait 1 minute, should work again

- [ ] **HIGH-2: Error Handler**
  - Trigger an API error
  - Check no "unhandled rejection" in console
  - Response should be proper JSON

- [ ] **HIGH-3: Error Boundary**
  - Temporarily add broken component
  - Verify error boundary UI shows
  - Verify "Refresh" button works
  - Remove broken component

### Verify Core Functionality

- [ ] **Landing Page**
  - Loads without errors
  - CTA visible
  - Navigation works

- [ ] **Upload Flow (Anonymous)**
  - Upload a test PDF
  - Processing completes
  - Preview shows results

- [ ] **Authentication**
  - Request magic link
  - (Can't test full flow without email)

- [ ] **Dashboard (Authenticated)**
  - Patents display correctly
  - Credit balance shows 30

---

## T-1 Day: Database & Environment

### Database Verification

- [ ] **Check Default Credits**
  - Verify new profiles get 30 credits
  - Location: Profile creation in `supabaseRoutes.ts`

- [ ] **Check Existing Test Users**
  - If any test users exist, update credits to 30
  - Use Supabase dashboard SQL:
    ```sql
    UPDATE profiles SET credits = 30 WHERE credits < 30;
    ```

### Environment Variables

Verify all required variables in Replit Secrets:

- [ ] `SUPABASE_URL` - Supabase project URL
- [ ] `SUPABASE_ANON_KEY` - Supabase anonymous key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- [ ] `ANTHROPIC_API_KEY` - Claude API key
- [ ] `OPENAI_API_KEY` - OpenAI/DALL-E API key
- [ ] `APP_URL` - Your Replit app URL
- [ ] `SENTRY_DSN` - Sentry server DSN
- [ ] `VITE_SENTRY_DSN` - Sentry client DSN
- [ ] `VITE_POSTHOG_KEY` - PostHog API key

### Replit Configuration

- [ ] **Verify .replit file**
  - Run command correct
  - Port configured

- [ ] **Check Deployment Settings**
  - Build command: `npm run build`
  - Run command: `npm run start`

---

## Launch Day: Deployment

### Pre-Deploy Checklist

- [ ] All tests passing
- [ ] No console errors in dev
- [ ] Monitoring configured
- [ ] Environment variables set
- [ ] Credit default is 30

### Deploy Steps

1. [ ] **Push to Replit**
   ```bash
   git push
   ```

2. [ ] **Verify Build**
   - Watch Replit console
   - Check for build errors

3. [ ] **Verify Startup**
   - Server starts successfully
   - Health check returns OK:
     ```bash
     curl https://your-app.replit.app/api/health
     ```

4. [ ] **Quick Smoke Test**
   - Visit landing page
   - Try upload
   - Check Sentry for errors
   - Check PostHog for events

### Post-Deploy Verification

- [ ] **Health Endpoint**
  ```bash
  curl https://your-app.replit.app/api/health
  # Should return: {"status":"ok", ...}
  ```

- [ ] **Rate Limiting Active**
  ```bash
  # Test magic link rate limit
  for i in {1..5}; do
    curl -X POST https://your-app.replit.app/api/auth/magic-link \
      -H "Content-Type: application/json" \
      -d '{"email": "test@test.com"}'
    sleep 0.5
  done
  # Last request should return 429
  ```

- [ ] **Monitoring Connected**
  - Check Sentry dashboard
  - Check PostHog dashboard
  - Check UptimeRobot status

---

## First Alpha User Onboarding

### User Communication

Send to each alpha tester:

```
Subject: IP Scaffold Alpha Access

Hi [Name],

Thank you for being an alpha tester! Here's what you need to know:

**Getting Started:**
1. Visit: https://your-app.replit.app
2. Click "Get Started" or "Upload"
3. Enter your email for a magic link
4. Upload a patent PDF

**Your Credits:**
You have 30 credits, which allows 3 patent uploads.

**What to Test:**
- Upload a patent PDF
- Review the generated artifacts
- Try different patent types if you have them

**Known Issues:**
- First load may be slow (cold start)
- Large PDFs (>5MB) take longer to process
- Some patent formats may have extraction issues

**Feedback:**
Please report any issues to: [your email]
Include:
- What you were doing
- What happened
- Screenshots if possible

Thank you for helping us improve!

Best,
[Your name]
```

### Track Alpha Users

Create a simple tracking sheet:

| Name | Email | Joined | Uploads | Issues Reported | Status |
|------|-------|--------|---------|-----------------|--------|
| | | | | | |

---

## First 24 Hours Monitoring

### Hour 0-1: Active Monitoring

- [ ] Watch Sentry for new errors
- [ ] Watch PostHog for user activity
- [ ] Monitor Replit logs
- [ ] Be available for immediate issues

### Hour 1-6: Regular Check-ins

Every 2 hours:
- [ ] Check Sentry error count
- [ ] Check PostHog event count
- [ ] Verify health endpoint
- [ ] Review any user feedback

### Hour 6-24: Periodic Monitoring

Every 4-6 hours:
- [ ] Sentry error review
- [ ] PostHog funnel analysis
- [ ] Cost monitoring (API usage)

### Key Metrics to Watch

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| Error rate | <5/hour | 5-20/hour | >20/hour |
| Upload success | >80% | 60-80% | <60% |
| Health check | <200ms | 200-1000ms | >1000ms |
| API costs | <$10/day | $10-50/day | >$50/day |

---

## Incident Response

### If Errors Spike

1. Check Sentry for error details
2. Identify if one user or multiple
3. Check if related to specific action
4. If critical, consider:
   - Rate limit reduction
   - Feature disable
   - Quick fix deploy

### If Server Unresponsive

1. Check UptimeRobot alert
2. Check Replit deployment status
3. Try redeploying
4. Check Supabase status
5. Communicate to users if extended

### If API Costs Spike

1. Check Anthropic/OpenAI dashboards
2. Identify which endpoint
3. Consider temporary rate limit reduction
4. Review for abuse patterns

### Rollback Procedure

If needed to rollback:

1. In Replit, go to Version Control
2. Find last working commit
3. Revert changes
4. Redeploy
5. Communicate to users

---

## Known Issues to Communicate

| Issue | Workaround | Fix ETA |
|-------|------------|---------|
| Cold start delay | Wait 10-15 seconds | Post-alpha |
| Large PDF slow | Keep under 5MB | Optimization planned |
| Some extraction misses | Manual check results | Learning system |

---

## Post-Alpha Day 1 Actions

### Immediate (Within 24h)

- [ ] Review all Sentry errors
- [ ] Review PostHog funnels
- [ ] Respond to user feedback
- [ ] Document any new issues

### Short-term (Within 1 week)

- [ ] Fix any critical bugs found
- [ ] Improve based on feedback
- [ ] Update documentation
- [ ] Plan for more users

### Medium-term (Within 1 month)

- [ ] Address all HIGH issues found
- [ ] Optimize based on usage patterns
- [ ] Plan beta launch

---

## Quick Reference

### Key URLs

- **App:** https://your-app.replit.app
- **Health:** https://your-app.replit.app/api/health
- **Sentry:** https://sentry.io/organizations/YOUR_ORG
- **PostHog:** https://app.posthog.com/project/YOUR_PROJECT
- **Supabase:** https://app.supabase.com/project/YOUR_PROJECT
- **UptimeRobot:** https://uptimerobot.com/dashboard

### Emergency Contacts

- Replit Status: https://status.replit.com
- Supabase Status: https://status.supabase.com
- Anthropic Status: https://status.anthropic.com
- OpenAI Status: https://status.openai.com

### Quick Commands

```bash
# Health check
curl https://your-app.replit.app/api/health

# Ping
curl https://your-app.replit.app/api/ping

# Check rate limit (magic link)
curl -X POST https://your-app.replit.app/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com"}'
```

---

## Success Criteria

Alpha is successful if:

- [ ] All testers can complete at least 1 upload
- [ ] Error rate stays under 5/hour
- [ ] No server downtime >5 minutes
- [ ] Monitoring captures useful data
- [ ] User feedback is actionable
- [ ] API costs stay under $50 total

---

**Ready for Alpha!**

Complete this checklist, take a deep breath, and launch. Remember:

- Alpha means learning, not perfection
- Expect issues - that's why it's alpha
- Quick response > perfect response
- Document everything for future reference
