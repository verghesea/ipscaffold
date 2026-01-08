# Quick Start for Replit AI

## What to Tell Replit AI

Copy and paste this to Replit AI:

---

**Build IP Scaffold following the complete documentation in this repository.**

**Start with:** `INSTRUCTIONS_FOR_REPLIT.md` - this is your main guide.

**Key points:**
1. Follow implementation order: Setup → Database → Services → Routes → Frontend → Admin
2. Use the **Refined Editorial design** (not basic Tailwind)
3. Copy complete code from `CODE_EXAMPLES.md` - don't rewrite it
4. Use AI prompts exactly as written in `PRD.md`
5. Create all files in the structure defined in `IMPLEMENTATION_GUIDE.md`

**Before you start, I need to provide:**
- Anthropic API key (from https://console.anthropic.com)
- SendGrid API key (from https://sendgrid.com)
- Flask secret key (generate with: `python -c "import secrets; print(secrets.token_hex(32))"`)

**Build order:**
1. Project structure + dependencies
2. Database models (5 models)
3. Services (5 services)
4. Routes (3 route files)
5. Frontend templates (Refined Editorial design)
6. Admin dashboard (optional but recommended)

**Reference documents:**
- `INSTRUCTIONS_FOR_REPLIT.md` - Your main guide
- `IMPLEMENTATION_GUIDE.md` - Step-by-step instructions
- `CODE_EXAMPLES.md` - Complete working code
- `DATABASE_SCHEMA.md` - Database structure
- `API_SPECIFICATION.md` - API endpoints
- `FRONTEND_REFINED_EDITORIAL.md` + Part 2 - User interface
- `FRONTEND_ADMIN_EDITORIAL.md` - Admin interface
- `PRD.md` - Full requirements

---

## Files Checklist

### Required Before Starting:
- [ ] Anthropic API key
- [ ] SendGrid API key
- [ ] Sample patent PDF for testing

### Files to Create (in order):

**Phase 1: Setup**
- [ ] `requirements.txt`
- [ ] `.env`
- [ ] `config.py`
- [ ] `app.py`

**Phase 2: Database Models**
- [ ] `models/database.py`
- [ ] `models/user.py`
- [ ] `models/patent.py`
- [ ] `models/artifact.py`
- [ ] `models/magic_token.py`
- [ ] `models/credit_transaction.py`

**Phase 3: Services**
- [ ] `services/pdf_parser.py`
- [ ] `services/ai_generator.py`
- [ ] `services/email_service.py`
- [ ] `services/document_generator.py`
- [ ] `services/credit_manager.py`

**Phase 4: Routes**
- [ ] `routes/public.py`
- [ ] `routes/auth.py`
- [ ] `routes/dashboard.py`
- [ ] `routes/admin.py` (optional)

**Phase 5: Frontend**
- [ ] `static/css/editorial.css`
- [ ] `static/js/editorial.js`
- [ ] `templates/base_editorial.html`
- [ ] `templates/landing_editorial.html`
- [ ] `templates/preview_editorial.html`
- [ ] `templates/email_sent_editorial.html`
- [ ] `templates/dashboard_editorial.html`
- [ ] `templates/patent_detail_editorial.html`
- [ ] `templates/email/magic_link.html`

**Phase 6: Admin (Optional)**
- [ ] `templates/admin/base_editorial.html`
- [ ] `templates/admin/login_editorial.html`
- [ ] `templates/admin/dashboard_editorial.html`
- [ ] `templates/admin/users_editorial.html`
- [ ] `templates/admin/analytics_editorial.html`

---

## Environment Variables Template

Create `.env` file with:

```bash
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
FLASK_SECRET_KEY=<generate-random-32-bytes>
FLASK_ENV=development
APP_URL=https://your-app.repl.co
MAX_UPLOAD_SIZE_MB=10
```

---

## Testing Flow

After build completes, test:

1. Visit `/` → should see editorial-styled landing page
2. Upload patent PDF
3. See ELIA15 displayed
4. Enter email
5. Check email (or logs) for magic link
6. Click link → dashboard
7. View patent → see all 3 artifacts
8. Download PDF/DOCX/TXT
9. Visit `/admin` → admin login
10. View metrics and analytics

---

## Cost Breakdown

**Per Patent Processing:**
- AI cost: ~$0.27 (Claude API)
- Email: Free (SendGrid 100/day)
- Storage: Negligible

**User pays:** $2/patent (10 credits @ $20/100)
**Margin:** ~$1.73/patent

---

## Success Criteria

✅ User can upload PDF and get ELIA15
✅ Email gate works
✅ All 3 artifacts generate
✅ Downloads work (PDF/DOCX/TXT)
✅ Credit system works
✅ Admin dashboard accessible
✅ Design looks refined and editorial (not generic)

---

## Quick Reference

**Main instruction file:** `INSTRUCTIONS_FOR_REPLIT.md`

**Get code from:** `CODE_EXAMPLES.md` + `IMPLEMENTATION_GUIDE.md`

**Get AI prompts from:** `PRD.md` (Section: AI Generation Specifications)

**Get frontend from:** `FRONTEND_REFINED_EDITORIAL.md` (Parts 1 & 2) + `FRONTEND_ADMIN_EDITORIAL.md`

**For help:** `DESIGN_IMPLEMENTATION_GUIDE.md` (design questions) or `IMPLEMENTATION_GUIDE.md` (technical questions)

---

**Ready to build!** 🚀
