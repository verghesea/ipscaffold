# Claude Development Guide

This document explains the development and deployment workflow for this project so Claude can assist effectively.

---

## Development & Deployment Workflow

### Architecture Overview
- **Development Environment**: MacBook laptop (local machine)
- **Version Control**: GitHub repository
- **Production Deployment**: Replit (live environment)

### The Workflow

```
Local Development (Laptop)
    ↓
Commit & Push to GitHub
    ↓
Pull on Replit
    ↓
Build & Restart on Replit
    ↓
Live Site Updates
```

### Step-by-Step Process

#### 1. Local Development (on laptop)
- Code changes are made locally in `/Users/averghese/claudecode/ipscaffold-repo`
- Testing can be done locally with `npm run dev`
- **IMPORTANT**: The laptop is NOT the live server

#### 2. Commit and Push to GitHub
```bash
git add .
git commit -m "Description of changes"
git push origin main
```

#### 3. Deploy to Replit
On Replit (live environment):
```bash
# Pull latest changes
git pull origin main

# Rebuild the application
npm run build

# Restart the server
# (Click Stop → Run in Replit UI)
```

#### 4. Verify Deployment
- Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Check browser console to verify new JavaScript bundle is loading
- Replit domain: `https://[repl-id].picard.replit.dev`

---

## Key Points for Claude

### ❌ Don't Do This
- **DON'T** assume changes are live just because they're committed locally
- **DON'T** try to start/stop servers on the laptop for production
- **DON'T** assume the user can see changes immediately after coding

### ✅ Do This
- **DO** remind the user to push to GitHub after making changes
- **DO** provide instructions for the full deployment workflow
- **DO** check git status to see if commits need pushing (`git status -sb`)
- **DO** remind about hard browser refresh after deployment

### Checking Deployment Status
```bash
# Check if local commits need pushing
git status -sb
# Example output: ## main...origin/main [ahead 2]
# "ahead 2" means 2 local commits not pushed yet

# Check recent commits
git log --oneline -5

# Verify build output
ls -la dist/public/assets/index-*.js
```

---

## Build Process

### Frontend Build
```bash
npm run build
```
- Uses Vite to bundle React application
- Outputs to `dist/public/`
- Creates hashed JavaScript bundles (e.g., `index-WkTuuYTA.js`)
- Updates `dist/public/index.html` to reference the new bundle

### Backend Build
- Server code built to `dist/index.cjs`
- Uses esbuild for bundling

### Production Start
```bash
npm start
# Runs: NODE_ENV=production node dist/index.cjs
```

---

## Common Issues & Solutions

### Issue: "Buttons/features don't appear after coding"
**Cause**: Changes are committed locally but not deployed to Replit

**Solution**:
1. Push to GitHub: `git push origin main`
2. Pull on Replit: `git pull origin main`
3. Rebuild: `npm run build`
4. Restart Replit server
5. Hard refresh browser

### Issue: "Old JavaScript bundle loading"
**Cause**: Browser caching or Replit serving stale files

**Solution**:
1. Verify latest bundle exists: `ls dist/public/assets/index-*.js`
2. Check `dist/public/index.html` references correct bundle
3. Hard refresh browser: `Cmd+Shift+R` or `Ctrl+Shift+R`
4. Clear browser cache if needed

### Issue: "EADDRINUSE: address already in use"
**Cause**: Old server process still running

**Solution** (on laptop):
```bash
lsof -ti:5000 | xargs kill -9
```

**On Replit**: Just click Stop → Run

---

## File Structure

### Key Directories
- `client/` - React frontend application
- `server/` - Express backend API
- `dist/` - Built output (not committed to git)
- `shared/` - Shared types between client and server

### Important Files
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Frontend build configuration
- `script/build.ts` - Custom build script
- `.gitignore` - Excludes `dist/`, `node_modules/`, etc.

---

## Environment Variables

**On Replit**, environment variables are set in the Replit Secrets panel:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `JWT_SECRET` - Session encryption

**Locally**, these can be set in a `.env` file (not committed).

---

## Testing Workflow

### Local Testing
```bash
npm run dev
# Server runs at http://localhost:5000
```

### Production Testing
- Always test on Replit after deployment
- Check browser console for errors
- Verify new JavaScript bundle is loading
- Test critical user flows

---

## Git Workflow

### Checking Status Before Helping User
```bash
# Are there uncommitted changes?
git status --short

# Are there unpushed commits?
git status -sb

# What's the latest commit?
git log --oneline -1
```

### Typical Development Cycle
1. User asks for feature/fix
2. Claude makes code changes locally
3. Test locally if possible
4. Commit changes: `git commit -m "description"`
5. **Remind user to deploy**: Push to GitHub → Pull on Replit → Build → Restart

---

## Debugging Deployment Issues

### When User Says "I don't see the changes"

**Step 1: Check if code is pushed**
```bash
git status -sb
# If shows [ahead X], changes aren't pushed yet
```

**Step 2: Ask user to verify on Replit**
- "Have you pulled the latest code on Replit?"
- "Have you rebuilt with `npm run build`?"
- "Have you restarted the Replit server?"

**Step 3: Check browser**
- "Have you hard refreshed? (Cmd+Shift+R)"
- "What JavaScript bundle is loading in the browser console?"
- Should see something like `index-[hash].js`

**Step 4: Verify build output**
- Check `dist/public/index.html` references correct bundle
- Check bundle exists: `ls dist/public/assets/`

---

## Quick Reference Commands

### On Laptop (Development)
```bash
# Check git status
git status -sb

# Commit and push
git add .
git commit -m "message"
git push origin main

# Build locally
npm run build

# Run dev server locally
npm run dev
```

### On Replit (Production)
```bash
# Pull latest code
git pull origin main

# Install dependencies (if package.json changed)
npm install

# Build application
npm run build

# Server will auto-restart, or manually restart via UI
```

### In Browser
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Clear cache: `Cmd+Shift+Delete` (Mac) or `Ctrl+Shift+Delete` (Windows)

---

## Summary for Claude

**Remember**: This project has a **three-stage deployment**:
1. **Local changes** (laptop) - where code is written
2. **GitHub** (version control) - where code is stored
3. **Replit** (production) - where code runs live

**Always remind the user** to complete all three stages when deploying changes!
