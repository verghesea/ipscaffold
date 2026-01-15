/**
 * DALL-E Modern Lab Aesthetic Testing Script
 *
 * Usage:
 * 1. Set your ANTHROPIC_API_KEY env variable (we'll use Claude to call DALL-E)
 * 2. Run: tsx test-dalle-modern-lab.ts
 * 3. Check the generated images in ./test-images/
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Modern Lab Aesthetic Base Template
const MODERN_LAB_BASE = `modern laboratory aesthetic, contemporary scientific research facility environment, clean white and clinical blue-gray color palette, soft diffused lighting, precise geometric composition, professional scientific illustration style, minimalist design, no text or labels, ultra-clean background, 16:9 aspect ratio`;

// Test Prompts for Different Section Types
const TEST_PROMPTS = {
  // ELIA15 Sections
  elia15_introduction: `Abstract visualization of a wireless power transmission system problem, showing tangled wires and complexity being solved, ${MODERN_LAB_BASE}`,

  elia15_invention: `Technical concept visualization of electromagnetic resonance coils and power transfer, clean geometric representation of wireless energy flow between devices, ${MODERN_LAB_BASE}`,

  elia15_functioning: `Exploded view technical illustration showing wireless charging coil assembly with magnetic field lines, precise component layout, ${MODERN_LAB_BASE}`,

  elia15_importance: `Abstract visualization representing efficiency improvement and innovation, showing transformation from complex to elegant solution, ${MODERN_LAB_BASE}`,

  elia15_why_matters: `Panoramic visualization of wireless power applications across multiple domains - medical devices, consumer electronics, industrial equipment shown as interconnected nodes, ${MODERN_LAB_BASE}`,

  // Business Narrative Sections
  business_problem: `Abstract visualization of a pain point in power delivery infrastructure, represented through visual tension with fragmented shapes and barriers against clean white background, clinical blue-gray and amber warning colors, ${MODERN_LAB_BASE}`,

  business_solution: `Elegant visualization of wireless charging innovation, showing refined crystalline or engineered magnetic field structure emerging from complexity, clean white environment with teal and silver accents, ${MODERN_LAB_BASE}`,

  business_market: `Abstract visualization of market expansion for wireless power technology, showing scaling through expanding geometric patterns or network graphs, clean white background, teal and amber accent colors, ${MODERN_LAB_BASE}`,

  // Golden Circle Sections
  golden_why: `Abstract visualization of purpose and innovation, represented through glowing energy core with concentric circles radiating outward, clean white environment with warm amber and teal colors, ${MODERN_LAB_BASE}`,

  golden_how: `Process and methodology visualization of electromagnetic coupling, showing interconnected circuits and flowing energy processes, clean white background with teal technical elements, ${MODERN_LAB_BASE}`,

  golden_what: `Product visualization of wireless charging pad as elegant geometric object, clean white studio environment, slate gray and teal colors, soft product photography lighting, ${MODERN_LAB_BASE}`,
};

// Generic fallback for testing
const GENERIC_MODERN_LAB = `Abstract conceptual visualization related to technological innovation and scientific advancement, ${MODERN_LAB_BASE}`;

interface ImageGenerationResult {
  promptName: string;
  prompt: string;
  success: boolean;
  imagePath?: string;
  error?: string;
}

async function testDallEPrompt(
  promptName: string,
  prompt: string,
  outputDir: string
): Promise<ImageGenerationResult> {
  console.log(`\n🎨 Testing: ${promptName}`);
  console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

  try {
    // Use Claude to generate the image description and then call DALL-E
    // Note: In real implementation, you'd call DALL-E directly
    // For now, we'll simulate with a placeholder

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `I need you to refine this DALL-E image prompt for maximum quality. The goal is a "Modern Lab" aesthetic - clean, clinical, scientific, contemporary research facility feel.

Original prompt:
${prompt}

Please provide:
1. An improved version of this prompt that will generate the best possible image
2. What you expect the image to look like
3. Any adjustments to ensure consistency with the Modern Lab aesthetic

Format your response as:
IMPROVED_PROMPT: [your improved prompt]
EXPECTED_OUTPUT: [description of what you expect]
ADJUSTMENTS: [any recommendations]`
      }]
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';

    // Save the refined prompt and analysis
    const analysisPath = path.join(outputDir, `${promptName}_analysis.txt`);
    fs.writeFileSync(analysisPath, content);

    console.log(`✅ Analysis saved to: ${analysisPath}`);
    console.log(`💡 Claude's feedback:\n${content.substring(0, 300)}...\n`);

    return {
      promptName,
      prompt,
      success: true,
      imagePath: analysisPath,
    };

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    return {
      promptName,
      prompt,
      success: false,
      error: error.message,
    };
  }
}

async function main() {
  console.log('🔬 DALL-E Modern Lab Aesthetic Testing');
  console.log('=' .repeat(60));

  // Create output directory
  const outputDir = path.join(process.cwd(), 'test-images');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`📁 Output directory: ${outputDir}`);

  // Test all prompts
  const results: ImageGenerationResult[] = [];

  for (const [name, prompt] of Object.entries(TEST_PROMPTS)) {
    const result = await testDallEPrompt(name, prompt, outputDir);
    results.push(result);

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TESTING SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  console.log('\n💡 Next Steps:');
  console.log('1. Review the analysis files in test-images/');
  console.log('2. Use Claude\'s improved prompts to generate actual images with DALL-E');
  console.log('3. Evaluate which prompts produce the best Modern Lab aesthetic');
  console.log('4. Refine prompts based on actual image output');

  // Save summary
  const summaryPath = path.join(outputDir, 'test-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\n📝 Summary saved to: ${summaryPath}`);
}

main().catch(console.error);
