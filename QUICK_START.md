# Quick Start Guide: Test Image Generation

Get your image generation system running in 5 steps!

---

## Step 1: Install OpenAI SDK

```bash
npm install openai
```

**Expected output:**
```
added 1 package, and audited 83 packages in 2s
```

---

## Step 2: Add OpenAI API Key

### Get Your API Key
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with `sk-`)

### Add to Environment
Add this line to your `.env` file:

```bash
OPENAI_API_KEY=sk-your-key-here
```

**⚠️ Never commit this key to git!**

---

## Step 3: Uncomment OpenAI Code

**File:** `server/services/imageGenerator.ts`

### Find Line 9 - Uncomment Import
```typescript
// BEFORE:
// import OpenAI from 'openai';

// AFTER:
import OpenAI from 'openai';
```

### Find Lines 30-35 - Uncomment Client Creation
```typescript
// BEFORE:
/*
return new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
*/

// AFTER:
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

return new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

### Find Lines 55-72 - Uncomment Image Generation
```typescript
// BEFORE:
/*
const response = await openai.images.generate({
  model: 'dall-e-3',
  prompt,
  size: '1792x1024',
  quality: 'hd',
  n: 1,
});

if (!response.data[0]?.url) {
  throw new Error('No image URL returned from DALL-E');
}

return {
  imageUrl: response.data[0].url,
  promptUsed: prompt,
  revisedPrompt: response.data[0].revised_prompt,
};
*/

// AFTER:
const response = await openai.images.generate({
  model: 'dall-e-3',
  prompt,
  size: '1792x1024',
  quality: 'hd',
  n: 1,
});

if (!response.data[0]?.url) {
  throw new Error('No image URL returned from DALL-E');
}

return {
  imageUrl: response.data[0].url,
  promptUsed: prompt,
  revisedPrompt: response.data[0].revised_prompt,
};
```

### Delete Temporary Error
Find and **DELETE** this line (around line 76):

```typescript
// DELETE THIS:
throw new Error('OpenAI SDK not installed. Run: npm install openai');
```

---

## Step 4: Run Database Migration

### Option A: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Click **SQL Editor** in sidebar
3. Click **New Query**
4. Copy entire contents of `supabase-migration-section-images.sql`
5. Paste into editor
6. Click **Run** (or press Cmd/Ctrl + Enter)

**Expected output:**
```
Success. No rows returned
```

### Option B: Command Line

```bash
# If you have Supabase CLI installed
supabase db push
```

### Verify Migration Worked

Run this query in SQL Editor:

```sql
SELECT * FROM section_images LIMIT 1;
```

**Expected:** Returns empty table (no error)

Check storage bucket:

```sql
SELECT * FROM storage.buckets WHERE name = 'section-images';
```

**Expected:** Returns 1 row with bucket info

---

## Step 5: Test Image Generation

### Start Your Server

```bash
npm run dev
```

**Expected output:**
```
5:00:00 PM [express] serving on port 5000
```

### Get an Artifact ID

Open a new terminal:

```bash
# Connect to your database and get an artifact ID
# Replace with your Supabase credentials

psql "postgresql://[YOUR_CONNECTION_STRING]" \
  -c "SELECT id, artifact_type FROM artifacts LIMIT 5;"
```

**Or** check your dashboard and copy an artifact UUID.

### Generate Images!

```bash
# Replace ARTIFACT_ID with a real UUID
curl -X POST http://localhost:5000/api/images/generate/[ARTIFACT_ID] | jq
```

**Example:**
```bash
curl -X POST http://localhost:5000/api/images/generate/123e4567-e89b-12d3-a456-426614174000 | jq
```

### Expected Response

```json
{
  "success": true,
  "imagesGenerated": 5,
  "sectionImages": [
    {
      "id": "uuid-here",
      "artifact_id": "123e4567-e89b-12d3-a456-426614174000",
      "section_number": 1,
      "section_title": "Introduction",
      "image_url": "https://your-supabase.co/storage/v1/object/public/section-images/...",
      "prompt_used": "Simple hand-drawn sketch...",
      "created_at": "2025-01-15T12:00:00Z"
    },
    ...
  ],
  "costEstimate": {
    "costUSD": 0.40,
    "breakdown": "5 images × $0.08 = $0.40"
  }
}
```

### Check the Images

1. Copy an `image_url` from the response
2. Open in your browser
3. You should see a simple 4-color pen sketch!

### Verify in Database

```sql
SELECT section_number, section_title, image_url
FROM section_images
WHERE artifact_id = 'your-artifact-id'
ORDER BY section_number;
```

---

## Troubleshooting

### Error: "OPENAI_API_KEY is not defined"
- Check `.env` file has the key
- Restart your server after adding

### Error: "401 Unauthorized"
- API key is invalid or expired
- Generate new key at https://platform.openai.com/api-keys

### Error: "429 Too Many Requests"
- You've hit rate limit
- Wait a minute and try again
- Or add delay between requests

### Error: "relation section_images does not exist"
- Migration didn't run
- Go back to Step 4

### Error: "bucket section-images not found"
- Storage bucket wasn't created
- Check migration ran completely
- Verify in Supabase Dashboard → Storage

### Images look wrong
- Check prompts in `server/services/dallePrompts.ts`
- Current prompts emphasize "simple", "minimal"
- Can be adjusted if needed

---

## What's Next?

✅ **Backend working?** Great! Now you can:

1. **Test different artifacts:**
   ```bash
   curl -X POST http://localhost:5000/api/images/generate/[ANOTHER_ARTIFACT_ID]
   ```

2. **View all images for an artifact:**
   ```bash
   curl http://localhost:5000/api/images/[ARTIFACT_ID] | jq
   ```

3. **Regenerate a single image:**
   ```bash
   curl -X POST http://localhost:5000/api/images/regenerate/[ARTIFACT_ID]/1
   ```

4. **Build the frontend:**
   - See `IMPLEMENTATION_ROADMAP.md` Phase 3-4
   - Reference `mockup-final-hybrid.html` for design

---

## Cost Monitoring

Each API call costs:
- ELIA15: 5 images × $0.08 = **$0.40**
- Business Narrative: 3 images × $0.08 = **$0.24**
- Golden Circle: 3 images × $0.08 = **$0.24**

**Total per patent: ~$0.88**

Check your OpenAI usage:
https://platform.openai.com/usage

---

## Support

**Issues?**
- Check `IMPLEMENTATION_SUMMARY.md` for detailed troubleshooting
- Review `IMPLEMENTATION_ROADMAP.md` for architecture
- Check DALL-E prompts in `dallePrompts.ts`

**Questions about the design?**
- Open `mockup-final-hybrid.html` in a browser
- Review `DALLE_PROMPTS_SIMPLE_SKETCH.md`

Ready to generate beautiful 4-color pen sketches! 🎨
