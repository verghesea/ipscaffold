# Modern Lab Aesthetic Testing Guide

This directory contains tools for testing and visualizing the "Modern Lab" aesthetic before full implementation.

## 📁 Files

1. **`mockup-modern-lab.html`** - Visual mockup showing the design
2. **`test-dalle-modern-lab.ts`** - Script to test DALL-E prompts
3. **`test-images/`** - Generated test images and analysis (created when you run the script)

---

## 🎨 Step 1: View the Visual Mockup

**Open the mockup in your browser:**

```bash
# Option A: Open directly
open mockup-modern-lab.html

# Option B: If you have a local server
npx serve . -p 3000
# Then visit: http://localhost:3000/mockup-modern-lab.html
```

**What to look for:**
- ✓ Overall "Modern Lab" feel - clinical, clean, scientific
- ✓ Color palette - teal accents, slate grays, white backgrounds
- ✓ Dot grid pattern on content blocks
- ✓ Image placeholders at 16:9 aspect ratio above each section
- ✓ Typography hierarchy and spacing
- ✓ Sharp corners (precision aesthetic)

**Questions to ask yourself:**
1. Does this feel "modern lab" or something else?
2. Is the dot grid pattern too busy or just right?
3. Do you prefer dot grid or clean white content blocks?
4. Are the teal accents working, or would you prefer another color?
5. Does the spacing feel right?

---

## 🧪 Step 2: Test DALL-E Prompts

**Run the testing script:**

```bash
# Make sure you have your Anthropic API key set
export ANTHROPIC_API_KEY="sk-ant-..."

# Run the test
tsx test-dalle-modern-lab.ts
```

**What this does:**
1. Takes each section type's DALL-E prompt
2. Asks Claude to analyze and improve the prompt
3. Saves the analysis to `test-images/[section]_analysis.txt`
4. Gives recommendations for refinement

**Review the output:**
- Check `test-images/` for analysis files
- Read Claude's improved prompts
- Note which sections need prompt refinement
- Identify consistency issues across prompts

---

## 🖼️ Step 3: Generate Actual DALL-E Images (Optional)

If you want to see actual generated images:

**Option A: Use OpenAI Playground**
1. Go to https://platform.openai.com/playground/images
2. Copy the improved prompts from the analysis files
3. Generate images with DALL-E 3
4. Save images to `test-images/` directory

**Option B: Create a DALL-E integration script**
```typescript
// You'll need OPENAI_API_KEY set
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateImage(prompt: string) {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    size: "1792x1024", // 16:9 aspect ratio
    quality: "hd",
    n: 1,
  });

  return response.data[0].url;
}
```

---

## 📊 Step 4: Compare Aesthetics

Once you have generated images, compare:

1. **Modern Lab** (this mockup)
   - Clean, clinical, contemporary
   - Teal and slate colors
   - Dot grid patterns
   - Technical precision feel

2. **Old Science** (to create next)
   - Parchment textures
   - Sepia tones
   - Hand-drawn aesthetic
   - Renaissance/vintage feel

3. **Mid Science** (to create next)
   - Laboratory notebook style
   - Grid paper backgrounds
   - 20th century journal aesthetic
   - Classic technical diagrams

**Decision Criteria:**
- Which aesthetic best represents your brand?
- Which feels most professional for your audience (researchers, investors)?
- Which images look most cohesive across all sections?
- Which aesthetic you'd be proud to show to users?

---

## 🔄 Iteration Process

1. **View mockup** → Adjust colors/spacing/layout
2. **Test prompts** → Refine prompt templates
3. **Generate images** → Evaluate actual output
4. **Compare aesthetics** → Pick winner
5. **Repeat** until satisfied

---

## ✏️ Making Changes

### Adjust Colors
Edit `mockup-modern-lab.html` and change CSS variables:
```css
:root {
  --lab-teal-500: #14b8a6;  /* Change this */
  --lab-slate-900: #1e293b; /* Or this */
}
```

### Adjust Spacing
Change padding/margin values:
```css
.content-block {
  padding: 1.5rem; /* Adjust this */
}
```

### Test Different Background Patterns
Toggle between:
- `.content-block` (dot grid)
- `.content-block-clean` (white)
- Or create new patterns

### Refine DALL-E Prompts
Edit `test-dalle-modern-lab.ts`:
```typescript
const MODERN_LAB_BASE = `...modify this base template...`;
```

---

## 🎯 Next Steps After Testing

Once you're happy with the aesthetic:

1. ✅ Finalize color palette
2. ✅ Lock in spacing system
3. ✅ Finalize DALL-E prompt templates
4. ✅ Choose background pattern (dot grid vs. clean)
5. ✅ Move to implementation (Option 1)

---

## 💡 Tips

- **View mockup on different screens** - desktop, tablet, mobile
- **Print the mockup** - see how it looks on paper (important for scientific content)
- **Show to 2-3 people** - get quick feedback on the aesthetic
- **Generate 3-4 test images** - see actual DALL-E output before committing
- **Don't overthink it** - pick something good enough and iterate later if needed

---

## 🆘 Troubleshooting

**Mockup looks broken:**
- Make sure you're opening the HTML file in a modern browser (Chrome, Firefox, Safari)
- Check browser console for errors

**Script won't run:**
- Make sure you have Node.js installed: `node --version`
- Install dependencies: `npm install`
- Check your ANTHROPIC_API_KEY is set: `echo $ANTHROPIC_API_KEY`

**DALL-E images look wrong:**
- Refine the prompt based on Claude's analysis
- Try adding more specific descriptors
- Experiment with different style keywords
- Generate multiple variations and pick the best

---

## 📝 Questions to Answer Before Implementation

- [ ] Do I like the Modern Lab aesthetic overall?
- [ ] Should I test Old Science or Mid Science aesthetics too?
- [ ] Dot grid pattern or clean white backgrounds?
- [ ] Are the teal accents right, or should I try another color?
- [ ] Do the DALL-E prompts produce consistent, high-quality images?
- [ ] Is the spacing/typography comfortable to read?
- [ ] Does this work on mobile?

Once you've answered these, you're ready for implementation!
