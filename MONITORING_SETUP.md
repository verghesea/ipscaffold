# Monitoring Setup Guide

This guide walks you through setting up PostHog (analytics) and Sentry (error monitoring) for IP Scaffold.

## Why These Tools?

### PostHog (Analytics)
- **Track user behavior** - See what features users actually use
- **Understand flows** - Where do users get stuck?
- **Feature flags** - Roll out features gradually
- **Session replay** - Watch how users interact with your app
- **Free tier** - 1M events/month, unlimited team members

### Sentry (Error Monitoring)
- **Catch bugs in production** - Know about errors before users complain
- **Stack traces** - See exactly where errors happen
- **User context** - Understand what the user was doing
- **Release tracking** - Know which version has bugs
- **Free tier** - 5K errors/month

---

## Part 1: PostHog Setup (15 minutes)

### Step 1: Create Account
1. Go to https://posthog.com/signup
2. Sign up with email or GitHub
3. Choose "Cloud" (recommended) or self-hosted

### Step 2: Create Project
1. After signup, you'll be prompted to create a project
2. **Project name**: `IP Scaffold` or `IP Scaffold - Alpha`
3. **Organization**: Your name or company
4. Click "Create project"

### Step 3: Get API Key
1. You'll see a setup page with installation instructions
2. Look for the **Project API Key** (starts with `phc_...`)
3. Copy this key

### Step 4: Configure Environment
1. Open your Replit project
2. Go to **Secrets** (lock icon in left sidebar)
3. Add new secret:
   - **Key**: `VITE_POSTHOG_KEY`
   - **Value**: Paste your `phc_...` key
4. Click "Add Secret"

### Step 5: Verify (After Deployment)
1. Visit your deployed app
2. Navigate around (upload, dashboard, etc.)
3. Return to PostHog dashboard
4. Go to **Activity** → You should see events coming in!
5. Check **Persons** → You should see anonymous users

### What Gets Tracked
PostHog automatically tracks:
- **Page views** - Every page visit
- **Clicks** - Button clicks and interactions
- **User sessions** - Time spent, paths taken

We've also added custom events:
- `upload_started` - User starts upload
- `upload_completed` - Patent processing complete
- `login_completed` - User logs in
- `artifact_viewed` - User views analysis
- `credits_viewed` - User checks credits
- And more... (see `client/src/lib/analytics.ts`)

### PostHog Features to Explore

**1. Insights (Analytics)**
- Go to **Product analytics** → **Insights**
- Create charts:
  - Daily active users
  - Upload completion rate
  - Time to first upload
  - Most viewed artifacts

**2. Session Replay**
- Go to **Product analytics** → **Recordings**
- Watch actual user sessions
- See where users struggle
- Privacy: inputs are masked by default

**3. Feature Flags** (for future)
- Go to **Feature management** → **Feature flags**
- Roll out features to 10% of users first
- A/B test different UX approaches

---

## Part 2: Sentry Setup (15 minutes)

### Step 1: Create Account
1. Go to https://sentry.io/signup
2. Sign up with email or GitHub
3. Choose the free tier

### Step 2: Create Project
1. After signup, click **"Create Project"**
2. **Platform**: Select **React**
3. **Project name**: `ip-scaffold-client` or `ip-scaffold-alpha`
4. **Alert frequency**: "Alert me on every new issue" (recommended for alpha)
5. Click **"Create Project"**

### Step 3: Get DSN
1. After project creation, you'll see setup instructions
2. Look for the **DSN** (looks like `https://abc123@o456.ingest.sentry.io/789`)
3. Copy the entire DSN URL

### Step 4: Configure Environment
1. In Replit, go to **Secrets**
2. Add new secret:
   - **Key**: `VITE_SENTRY_DSN`
   - **Value**: Paste your full DSN URL
3. Click "Add Secret"

### Step 5: Verify (After Deployment)
1. Visit your app
2. Open browser console (F12)
3. Run: `throw new Error("Test Sentry");`
4. Go to Sentry dashboard → **Issues**
5. You should see the test error!

### What Gets Captured
Sentry automatically captures:
- **JavaScript errors** - Uncaught exceptions
- **React errors** - Component rendering errors
- **Promise rejections** - Async errors
- **Network failures** - Failed API calls
- **Performance** - Slow pages/operations

Context included with each error:
- User ID and email (when logged in)
- URL and page
- Browser and OS
- Stack trace
- Breadcrumbs (user actions leading to error)

### Sentry Features to Use

**1. Issues Dashboard**
- See all errors in production
- Errors are grouped by type
- See frequency and user impact

**2. Releases**
- Track which version has bugs
- We'll set this up with git commits
- See regressions between versions

**3. Alerts**
- Get email/Slack when errors happen
- Set up: **Settings** → **Alerts**
- Recommended: "Send alert when new issue occurs"

---

## Part 3: Deployment

Once you've added the secrets to Replit:

### Option 1: Automatic (Recommended)
Replit will automatically redeploy when it detects the new environment variables.

### Option 2: Manual
```bash
# In Replit shell
npm run build
# App will restart automatically
```

### Verification Checklist

**PostHog**:
- [ ] Go to PostHog dashboard → Activity
- [ ] Visit your app and navigate around
- [ ] Refresh PostHog → See events appearing
- [ ] Check Persons → See users tracked

**Sentry**:
- [ ] Go to Sentry dashboard → Issues
- [ ] Should be empty (no errors yet!)
- [ ] Test with: `throw new Error("Test");` in console
- [ ] See error appear in dashboard

---

## Part 4: Integrate with User Auth

The code already includes user identification - it just needs the API keys!

When a user logs in, we automatically:
```javascript
// PostHog
identifyUser(userId, {
  email: user.email,
  credits: user.credits,
  isAdmin: user.isAdmin
});

// Sentry
identifyUser(userId, user.email, {
  credits: user.credits,
  displayName: user.displayName
});
```

This means:
- Analytics events are tied to specific users
- Errors include user context
- You can filter by user properties

---

## Monitoring Best Practices

### For Alpha Launch

**1. Daily Check-Ins**
- Check Sentry every morning for new errors
- Review PostHog weekly for usage patterns

**2. Set Up Alerts**
- Sentry: Email on every new issue
- PostHog: Weekly digest (Settings → Notifications)

**3. Key Metrics to Watch**
- Daily active users
- Upload success rate (uploads / attempts)
- Error rate (errors / sessions)
- Time to complete upload

**4. Privacy**
- PostHog masks all input fields by default
- Sentry excludes sensitive headers
- Both comply with GDPR

### Common Issues

**PostHog not tracking?**
- Check browser console for errors
- Verify `VITE_POSTHOG_KEY` is set correctly
- Make sure you're not in dev mode (or set `VITE_ANALYTICS_DEV=true`)

**Sentry not capturing errors?**
- Check browser console for Sentry init message
- Verify `VITE_SENTRY_DSN` is set correctly
- Test with: `window.Sentry.captureException(new Error("Test"))`

**Too many events in PostHog?**
- PostHog auto-captures clicks by default
- Can disable: `autocapture: false` in init config

---

## Cost Planning

### PostHog Free Tier
- **1M events/month** - More than enough for alpha
- **Unlimited team members**
- **1 year data retention**
- **Session replay**: 5K recordings/month

Estimated usage for 100 alpha users:
- ~50 events/user/week
- ~20K events/month
- **Well within free tier**

When you hit limits:
- $0.00045/event after 1M (~$450 for 2M events)
- Or upgrade to paid tier at $450/month for 10M events

### Sentry Free Tier
- **5K errors/month** - Should be plenty if your app is stable
- **1 project**
- **1 user**
- **30 day history**

Estimated usage for alpha:
- Goal: < 100 errors/month (< 1 error/user)
- Spike after launch, then stabilize
- **Should stay in free tier**

When you hit limits:
- $26/month for 50K errors (Developer plan)

**Budget Recommendation**: $0/month during alpha, evaluate after 100 users.

---

## Next Steps

1. ✅ Complete PostHog setup (15 min)
2. ✅ Complete Sentry setup (15 min)
3. ✅ Deploy with environment variables
4. ✅ Test both integrations
5. 📊 Create PostHog dashboard with key metrics
6. 🔔 Set up Sentry alert rules
7. 📧 Add team members (optional)

---

## Support

- **PostHog docs**: https://posthog.com/docs
- **PostHog community**: https://posthog.com/questions
- **Sentry docs**: https://docs.sentry.io
- **Sentry support**: support@sentry.io

---

## Already Set Up in Code ✅

You don't need to write any code! The integration is complete:

- ✅ Analytics tracking in all key user flows
- ✅ Error boundary with Sentry reporting
- ✅ User identification on login/logout
- ✅ Privacy settings (mask inputs, respect DNT)
- ✅ Development mode disabled by default
- ✅ Custom events for patent upload flow
- ✅ Performance monitoring configured

Just add the API keys and deploy! 🚀
