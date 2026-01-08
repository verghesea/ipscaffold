# Instructions for Replit AI - Building IP Scaffold

## Project Overview

Build **IP Scaffold**, a web application that transforms patent PDFs into business-ready artifacts using AI.

**What it does:**
- User uploads patent PDF (no account required)
- System generates ELIA15 (simplified explanation)
- User enters email, receives magic link
- System generates Business Narrative + Golden Circle
- User logs in, views all 3 artifacts, downloads as PDF/DOCX/TXT

**Tech Stack:**
- Backend: Python + Flask
- Database: PostgreSQL
- AI: Anthropic Claude API
- Frontend: Refined Editorial design (custom CSS)
- Email: SendGrid

---

## Implementation Order

### Phase 1: Project Setup (Start Here)
**Follow:** `IMPLEMENTATION_GUIDE.md` Phase 1

1. Create project structure (all folders and files)
2. Install dependencies from `requirements.txt`
3. Create `.env` file with environment variables
4. Set up `config.py`

**Key Files to Create:**
- `app.py` (main Flask app)
- `config.py` (configuration)
- `requirements.txt` (dependencies)
- `.env` (environment variables - DO NOT COMMIT)

---

### Phase 2: Database Models
**Follow:** `DATABASE_SCHEMA.md` + `IMPLEMENTATION_GUIDE.md` Phase 2

Create all database models in `models/` directory:
1. `models/database.py` - Database connection
2. `models/user.py` - User model
3. `models/patent.py` - Patent model
4. `models/artifact.py` - Artifact model
5. `models/magic_token.py` - Magic token model
6. `models/credit_transaction.py` - Credit transaction model

**Use the SQLAlchemy model code from `DATABASE_SCHEMA.md`** - it's production-ready.

---

### Phase 3: Services (Core Logic)
**Follow:** `CODE_EXAMPLES.md` + `IMPLEMENTATION_GUIDE.md` Phase 3

Create all services in `services/` directory:
1. `services/pdf_parser.py` - Parse patent PDFs
2. `services/ai_generator.py` - Generate artifacts with Claude API
3. `services/email_service.py` - Send magic link emails
4. `services/document_generator.py` - Generate PDF/DOCX/TXT downloads
5. `services/credit_manager.py` - Credit system logic

**Important:** Copy the complete implementations from `CODE_EXAMPLES.md` - they include:
- AI prompts (ELIA15, Business Narrative, Golden Circle)
- PDF parsing regex patterns
- Document generation logic

---

### Phase 4: Routes (API Endpoints)
**Follow:** `API_SPECIFICATION.md` + `CODE_EXAMPLES.md`

Create route handlers in `routes/` directory:
1. `routes/public.py` - Landing, upload, preview, email gate
2. `routes/auth.py` - Magic link verification, logout
3. `routes/dashboard.py` - Dashboard, patent detail, downloads

**Reference:** `API_SPECIFICATION.md` has complete endpoint specs with request/response formats.

---

### Phase 5: Frontend Templates
**IMPORTANT DECISION: Use Refined Editorial Design**

**Follow:** `FRONTEND_REFINED_EDITORIAL.md` (Parts 1 & 2) + `FRONTEND_ADMIN_EDITORIAL.md`

#### Step 5.1: Create CSS and JavaScript

Create `static/css/editorial.css`:
- Copy complete CSS from `FRONTEND_REFINED_EDITORIAL.md`
- This includes all design tokens, typography, animations

Create `static/js/editorial.js`:
- Copy from `FRONTEND_REFINED_EDITORIAL_PART2.md`
- Handles scroll animations, form validation

#### Step 5.2: Create User Templates

Create in `templates/` directory:
1. `base_editorial.html` - Base template (from Part 1)
2. `landing_editorial.html` - Landing page (from Part 1)
3. `preview_editorial.html` - ELIA15 preview + email gate (from Part 2)
4. `email_sent_editorial.html` - Email confirmation (from Part 2)
5. `dashboard_editorial.html` - User dashboard (from Part 2)
6. `patent_detail_editorial.html` - Patent + artifacts view (from Part 2)

#### Step 5.3: Create Admin Templates

Create in `templates/admin/` directory:
1. `base_editorial.html` - Admin base (from `FRONTEND_ADMIN_EDITORIAL.md`)
2. `login_editorial.html` - Admin login
3. `dashboard_editorial.html` - Admin dashboard
4. `users_editorial.html` - User management
5. `analytics_editorial.html` - Analytics with charts

#### Step 5.4: Create Email Template

Create `templates/email/magic_link.html`:
- Copy from `CODE_EXAMPLES.md`

---

### Phase 6: Admin Routes (Optional but Recommended)
**Follow:** `ADMIN_DASHBOARD.md`

Create `routes/admin.py`:
- Admin authentication
- Dashboard with metrics
- User management
- Patent analytics

**Database Update:**
```sql
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
```

---

### Phase 7: Main Application Setup
**Follow:** `IMPLEMENTATION_GUIDE.md` Phase 6

Create `app.py`:
1. Initialize Flask app
2. Configure database
3. Set up Flask-Login
4. Register blueprints (public, auth, dashboard, admin)
5. Add error handlers

**Reference:** `IMPLEMENTATION_GUIDE.md` has complete `app.py` code.

---

## Critical Configuration

### Environment Variables Required

Create `.env` file with:

```bash
# Database (Replit provides automatically)
DATABASE_URL=postgresql://...

# Anthropic API (get from https://console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-...

# SendGrid (get from https://sendgrid.com)
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Flask
FLASK_SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
FLASK_ENV=development

# App
APP_URL=https://your-app.repl.co
MAX_UPLOAD_SIZE_MB=10
```

### API Keys You Need

1. **Anthropic Claude API:**
   - Sign up at https://console.anthropic.com
   - Get API key from dashboard
   - **Cost:** ~$0.27 per patent (ELIA15 + Business Narrative + Golden Circle)

2. **SendGrid:**
   - Sign up at https://sendgrid.com
   - Free tier: 100 emails/day (sufficient for MVP)
   - Verify sender email address in SendGrid dashboard

---

## AI Prompts (Critical)

**DO NOT modify the AI prompts** - they are carefully crafted. Find them in:

- **ELIA15 Prompt:** `PRD.md` under "AI Generation Specifications"
- **Business Narrative Prompt:** `PRD.md` under "AI Generation Specifications"
- **Golden Circle Prompt:** `PRD.md` under "AI Generation Specifications"

These are also already implemented in `services/ai_generator.py` from `CODE_EXAMPLES.md`.

---

## File Upload Configuration

**Create uploads directory:**
```bash
mkdir uploads
```

**Add to `.gitignore`:**
```
uploads/
.env
__pycache__/
*.pyc
```

---

## Testing Checklist

After building, test this flow:

### User Flow Test:
1. ✅ Visit landing page (should load with editorial design)
2. ✅ Upload sample patent PDF
3. ✅ See ELIA15 generated and displayed
4. ✅ Enter email in gate
5. ✅ Check email for magic link
6. ✅ Click magic link → logs in
7. ✅ See dashboard with patent listed
8. ✅ Click patent → view all 3 artifacts
9. ✅ Download PDF/DOCX/TXT
10. ✅ Upload second patent (check credit deduction)

### Admin Flow Test:
1. ✅ Visit `/admin` → login page
2. ✅ Log in as admin user
3. ✅ See dashboard with metrics
4. ✅ View users list
5. ✅ View patents list
6. ✅ View analytics with charts

---

## Common Issues & Solutions

### Issue: Fonts not loading
**Solution:** Ensure `editorial.css` includes Google Fonts import at the top

### Issue: PDF parsing fails
**Solution:** Test with US patents only (MVP scope). Check `services/pdf_parser.py` regex patterns.

### Issue: AI generation fails
**Solution:**
- Verify `ANTHROPIC_API_KEY` is set correctly
- Check API key has sufficient credits
- Check error logs for API response

### Issue: Email not sending
**Solution:**
- Verify `SENDGRID_API_KEY` is correct
- Verify sender email is verified in SendGrid
- Check SendGrid dashboard for delivery logs

### Issue: Background artifact generation not working
**Solution:** Ensure threading is working in `routes/public.py`. Check `app.app_context()` is used.

---

## Design Notes

**The Refined Editorial Design:**
- Uses Playfair Display (serif) for headings
- Work Sans (sans) for body text
- JetBrains Mono for code/data
- Deep blues (#0A1F3D) + refined amber (#B8860B)
- Generous whitespace
- Smooth, slow animations (400-600ms)

**Why this matters:**
- Looks prestigious and trustworthy (not generic AI tool)
- Perfect for academic/TTO/researcher audience
- Memorable and distinctive

**Reference:** `DESIGN_IMPLEMENTATION_GUIDE.md` for customization.

---

## Production Deployment

Before going live:

1. ✅ Set `FLASK_ENV=production` in `.env`
2. ✅ Use production database (not SQLite)
3. ✅ Enable HTTPS (Replit does this automatically)
4. ✅ Minify CSS/JS (optional but recommended)
5. ✅ Set up error logging
6. ✅ Test with real patent PDFs
7. ✅ Verify email delivery works
8. ✅ Check AI generation quality

---

## Document Reference Map

When you need to:

| Task | Reference Document |
|------|-------------------|
| Understand what to build | `PRD.md` |
| Set up database | `DATABASE_SCHEMA.md` |
| Create API endpoints | `API_SPECIFICATION.md` |
| Get implementation code | `CODE_EXAMPLES.md` + `IMPLEMENTATION_GUIDE.md` |
| Build admin dashboard | `ADMIN_DASHBOARD.md` |
| Implement frontend | `FRONTEND_REFINED_EDITORIAL.md` (Parts 1 & 2) |
| Implement admin UI | `FRONTEND_ADMIN_EDITORIAL.md` |
| Customize design | `DESIGN_IMPLEMENTATION_GUIDE.md` |
| Understand requirements | `PRD.md` |

---

## Success Criteria

MVP is complete when:

1. ✅ User can upload patent PDF anonymously
2. ✅ ELIA15 generates and displays
3. ✅ Email gate works (magic link sent)
4. ✅ User can log in via magic link
5. ✅ Business Narrative + Golden Circle generated
6. ✅ User sees dashboard with patents
7. ✅ User can view all 3 artifacts
8. ✅ User can download PDF/DOCX/TXT
9. ✅ Credit system works (100 free, -10 per patent)
10. ✅ Admin can log in and view metrics
11. ✅ Design looks refined and editorial (not generic)
12. ✅ All pages responsive on mobile

---

## Additional Resources

**Sample Patent for Testing:**
- Download from https://patents.google.com
- Use any US utility patent
- Look for patents from MIT, Stanford, Caltech for realistic testing

**Debugging:**
- Check Flask logs for errors
- Use browser DevTools for frontend issues
- Check database with SQL queries
- Review Anthropic API dashboard for usage

---

## Final Notes

**Build Order Summary:**
1. Setup → Database → Services → Routes → Frontend → Admin → Testing

**Key Files to Start:**
1. `app.py` (main entry point)
2. `requirements.txt` (dependencies)
3. `config.py` (configuration)
4. `.env` (secrets)

**Most Important:**
- Use the complete code from `CODE_EXAMPLES.md`
- Use the AI prompts exactly as written in `PRD.md`
- Use the Refined Editorial templates (not basic Tailwind)
- Test with real patent PDFs

**Estimated Build Time:** 6-8 hours following documentation

---

## Questions?

If you encounter issues:
1. Check the specific documentation file for that component
2. Review `DESIGN_IMPLEMENTATION_GUIDE.md` for frontend issues
3. Check `IMPLEMENTATION_GUIDE.md` for step-by-step instructions
4. Review error logs carefully

**Good luck building IP Scaffold!** 🚀

The documentation is comprehensive - everything you need is in these files.
