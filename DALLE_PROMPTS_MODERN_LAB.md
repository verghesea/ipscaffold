# DALL-E Prompts for Modern Lab Aesthetic

Use these prompts to generate test images and evaluate the Modern Lab aesthetic.

## 🎯 Base Template

All prompts follow this structure:
```
modern laboratory aesthetic, contemporary scientific research facility environment,
clean white and clinical blue-gray color palette, soft diffused lighting, precise
geometric composition, professional scientific illustration style, minimalist design,
no text or labels, ultra-clean background, 16:9 aspect ratio
```

---

## 📋 ELIA15 Section Prompts

### 1. Introduction
```
Abstract visualization of a wireless power transmission system problem, showing tangled wires and complexity being solved, modern laboratory aesthetic, contemporary scientific research facility environment, clean white and clinical blue-gray color palette, soft diffused lighting, precise geometric composition, professional scientific illustration style, minimalist design, no text or labels, ultra-clean background, 16:9 aspect ratio
```

**Expected Output:** Abstract visualization showing the problem space - maybe tangled cables/wires transforming into clean wireless energy flow. Should feel cluttered-to-clean.

---

### 2. The Invention
```
Technical concept visualization of electromagnetic resonance coils and power transfer, clean geometric representation of wireless energy flow between devices, modern laboratory aesthetic, contemporary scientific research facility environment, clean white and clinical blue-gray color palette, soft diffused lighting, precise geometric composition, professional scientific illustration style, minimalist design, no text or labels, ultra-clean background, 16:9 aspect ratio
```

**Expected Output:** Clean technical diagram showing coils and energy transfer. Think electromagnetic field lines, elegant geometry. Should feel precise and scientific.

---

### 3. Detailed Functioning
```
Exploded view technical illustration showing wireless charging coil assembly with magnetic field lines, precise component layout, modern laboratory aesthetic, contemporary scientific research facility environment, clean white and clinical blue-gray color palette, soft diffused lighting, precise geometric composition, professional scientific illustration style, minimalist design, no text or labels, ultra-clean background, 16:9 aspect ratio
```

**Expected Output:** Exploded/deconstructed view showing components separated but aligned. Like a technical manual illustration. Field lines visible.

---

### 4. Importance
```
Abstract visualization representing efficiency improvement and innovation, showing transformation from complex to elegant solution, modern laboratory aesthetic, contemporary scientific research facility environment, clean white and clinical blue-gray color palette, soft diffused lighting, precise geometric composition, professional scientific illustration style, minimalist design, no text or labels, ultra-clean background, 16:9 aspect ratio
```

**Expected Output:** Conceptual visualization of improvement/progress. Maybe a before/after, or ascending progression. Should feel optimistic.

---

### 5. Why It Matters
```
Panoramic visualization of wireless power applications across multiple domains - medical devices, consumer electronics, industrial equipment shown as interconnected nodes, modern laboratory aesthetic, contemporary scientific research facility environment, clean white and clinical blue-gray color palette, soft diffused lighting, precise geometric composition, professional scientific illustration style, minimalist design, no text or labels, ultra-clean background, 16:9 aspect ratio
```

**Expected Output:** Broader perspective showing many application areas as connected network. Should feel expansive and possibilities-focused.

---

## 💼 Business Narrative Section Prompts

### 1. Problem Definition
```
Abstract visualization of a pain point in power delivery infrastructure, represented through visual tension with fragmented shapes and barriers against clean white background, clinical blue-gray and amber warning colors, modern laboratory aesthetic, contemporary scientific research facility environment, soft diffused lighting, precise geometric composition, professional scientific illustration style, minimalist design, no text or labels, 16:9 aspect ratio
```

**Expected Output:** Visual tension - broken/fragmented elements, barriers, complexity. Should feel like a challenge to overcome.

---

### 2. Solution (Your IP)
```
Elegant visualization of wireless charging innovation, showing refined crystalline or engineered magnetic field structure emerging from complexity, clean white environment with teal and silver accents, modern laboratory aesthetic, contemporary scientific research facility environment, soft studio lighting, sleek product-visualization style, professional scientific illustration, no text or labels, 16:9 aspect ratio
```

**Expected Output:** Elegant, refined solution imagery. Should feel like "aha!" moment - clarity emerging. Almost product-like.

---

### 3. Market Opportunity
```
Abstract visualization of market expansion for wireless power technology, showing scaling through expanding geometric patterns or network graphs, clean white background, teal and amber accent colors, data-visualization inspired style, modern laboratory aesthetic, contemporary scientific research facility environment, professional scientific illustration, no text or labels, 16:9 aspect ratio
```

**Expected Output:** Growth/expansion visualization. Think data viz style - expanding networks, scaling patterns. Should feel like opportunity.

---

## 🎯 Golden Circle Section Prompts

### 1. WHY
```
Abstract visualization of purpose and innovation, represented through glowing energy core with concentric circles radiating outward, clean white environment with warm amber and teal colors, soft ethereal lighting, philosophical yet scientific style, modern laboratory aesthetic, contemporary scientific research facility environment, professional illustration, no text or labels, 16:9 aspect ratio
```

**Expected Output:** Core/center with radiating energy. Should feel foundational, purposeful. Like the "heart" of the innovation.

---

### 2. HOW
```
Process and methodology visualization of electromagnetic coupling, showing interconnected circuits and flowing energy processes, clean white background with teal technical elements, technical diagram aesthetic, precise lines and curves, soft lighting, modern laboratory aesthetic, contemporary scientific research facility environment, professional illustration, no text or labels, 16:9 aspect ratio
```

**Expected Output:** Process diagram showing how things connect and flow. Should feel methodical, systematic. Technical but elegant.

---

### 3. WHAT
```
Product visualization of wireless charging pad as elegant geometric object, clean white studio environment, slate gray and teal colors, soft product photography lighting, minimalist style, modern laboratory aesthetic, contemporary scientific research facility environment, professional illustration, no text or labels, 16:9 aspect ratio
```

**Expected Output:** Product-style render of the tangible outcome. Should feel real, achievable. Like an Apple product photo.

---

## 🧪 How to Test These Prompts

### Option A: OpenAI Playground (Easiest)
1. Go to https://platform.openai.com/playground/images
2. Select DALL-E 3
3. Choose size: **1792x1024** (16:9 aspect ratio)
4. Choose quality: **HD**
5. Copy/paste prompts above
6. Generate and save images

### Option B: API Script
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateImage(prompt) {
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

### Option C: ChatGPT Plus
If you have ChatGPT Plus subscription:
1. Open ChatGPT
2. Start new conversation
3. Paste prompt
4. ChatGPT will generate using DALL-E 3
5. Right-click and save image

---

## 📊 Evaluation Criteria

When reviewing generated images:

### Aesthetic Consistency
- [ ] Do all images feel cohesive?
- [ ] Is the "Modern Lab" aesthetic clear?
- [ ] Are colors consistent (teal, slate, white)?
- [ ] Do they all feel scientific/professional?

### Quality
- [ ] Are images high-resolution and sharp?
- [ ] Is the composition clean and uncluttered?
- [ ] Are there unwanted text/labels (should be none)?
- [ ] Do they look professional enough for a patent analysis platform?

### Content Relevance
- [ ] Does the image represent the section's content?
- [ ] Is it abstract enough to apply to different patents?
- [ ] Or too generic?
- [ ] Does it enhance understanding or just decoration?

### Usability
- [ ] Do images work at 16:9 aspect ratio?
- [ ] Will they look good on mobile?
- [ ] Do they complement the text without overwhelming it?
- [ ] Are they accessible (clear enough for all users)?

---

## 🎨 Prompt Refinement Tips

If images don't match expectations:

### Too Busy/Complex
Add: "ultra minimalist", "simple composition", "negative space"

### Wrong Colors
Adjust: "clinical teal and slate gray only", "monochromatic with teal accent"

### Too Abstract/Too Literal
Adjust balance: "technical diagram style" vs. "conceptual abstract visualization"

### Not Scientific Enough
Add: "scientific instrument aesthetic", "laboratory equipment style", "research facility"

### Too Cold/Clinical
Add: "soft lighting", "warm white background", "approachable"

---

## 🔄 Iteration Process

1. **Generate 3 images** from different categories (ELIA15, Business, Golden)
2. **Evaluate consistency** - do they feel like a cohesive set?
3. **Refine base template** - adjust colors, style keywords
4. **Regenerate** with updated template
5. **Compare** old vs. new
6. **Repeat** until satisfied

---

## 💡 Alternative Aesthetic Prompts (Future Testing)

### Old Science Aesthetic
```
illustrated in the style of renaissance scientific manuscripts, sepia tones,
hand-drawn on aged parchment with ink annotations, vintage scientific illustration,
historical document aesthetic, 16:9 aspect ratio
```

### Mid Science Aesthetic (Lab Notebook)
```
illustrated as technical diagram in laboratory notebook, grid paper background,
precise line drawings, vintage scientific journal style from 1960s-1980s,
black ink on cream paper, 16:9 aspect ratio
```

---

## 📝 Notes

**Cost Estimate:**
- DALL-E 3 HD: ~$0.08 per image
- Testing 11 prompts: ~$0.88
- With iterations (3x): ~$2.64

**Time Estimate:**
- Generation: ~30-60 seconds per image
- Full test batch: ~15-20 minutes
- Review and refinement: 30-60 minutes

**Recommendation:**
Generate 3-4 images first (one from each artifact type) to test the aesthetic before generating all 11.
