import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface AIGenerationResult {
  content: string;
  tokensUsed: number;
  generationTimeSeconds: number;
}

const ELIA15_PROMPT = `ELIA15: You are a professional skilled in simplifying complex scientific and technical information. Your task is to explain the content of the provided patent to a professional audience in a clear and engaging manner, using language and analogies that would be understandable to a 15-year-old. Please follow this structure:

1. **Introduction:**
   - Introduce the problem the invention aims to solve in straightforward terms.
   - Use analogies or relatable examples to make the problem clear.

2. **The Invention:**
   - Describe the invention concisely, explaining what it does.
   - Use clear language, avoiding unnecessary jargon.

3. **Detailed Functioning:**
   - Outline the main components of the invention and their functions.
   - Explain how these components interact to solve the problem.

4. **Importance:**
   - Highlight why the invention is important and how it improves existing solutions.
   - Discuss the practical benefits and applications of the invention.

5. **Why It Matters:**
   - Discuss why understanding this invention is important.
   - Mention other areas where the invention can be useful.`;

const BUSINESS_NARRATIVE_PROMPT = `Generate a business narrative that effectively communicates the value of this intellectual property (IP) for commercialization. Follow this structure:

Essential Sections:
1. Problem Definition – Clearly articulate the pain point or unmet need.
2. Solution (Your IP) – Introduce how your innovation uniquely solves the problem.
3. Why It Matters – Highlight key advantages over existing solutions.
4. Market Opportunity – Define potential customers, industry demand, and scalability.
5. Go-to-Market Strategy – Explain the path from development to commercialization.`;

const GOLDEN_CIRCLE_PROMPT = `This is the Golden Circle framework based on Simon Sinek's work. Create a Golden Circle analysis for this patent that defines the WHY, HOW, and WHAT.

Framework:
- WHY: Why does this innovation exist beyond making money? What is the overarching purpose? Why should customers care?
- HOW: How does this innovation achieve its objective? What is the secret sauce or methodology that makes it unique?
- WHAT: What does this technology do? What tangible product or good does it create? What intangible service does it provide?

Format your response with clear sections for WHY, HOW, and WHAT. Each section should be 2-4 paragraphs.`;

export async function generateELIA15(fullText: string, title: string): Promise<AIGenerationResult> {
  const startTime = Date.now();

  // Get system prompt from database (with fallback to hardcoded)
  const { getSystemPromptWithFallback } = await import('./SystemPromptService');
  const systemPrompt = await getSystemPromptWithFallback('elia15');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `${systemPrompt}\n\nPatent Title: ${title}\n\nPatent Full Text:\n${fullText.substring(0, 100000)}`
    }]
  });
  
  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  const generationTimeSeconds = Math.round((Date.now() - startTime) / 1000);
  
  return {
    content,
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
    generationTimeSeconds
  };
}

export async function generateBusinessNarrative(fullText: string, elia15Content: string): Promise<AIGenerationResult> {
  const startTime = Date.now();

  // Get system prompt from database (with fallback to hardcoded)
  const { getSystemPromptWithFallback } = await import('./SystemPromptService');
  const systemPrompt = await getSystemPromptWithFallback('business_narrative');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 5000,
    messages: [{
      role: 'user',
      content: `${systemPrompt}\n\nYou have already created this simplified explanation (ELIA15):\n${elia15Content}\n\nHere is the full patent text:\n${fullText.substring(0, 80000)}\n\nUse the ELIA15 to understand the technology clearly, then create a compelling business narrative that would resonate with investors, partners, and potential licensees.`
    }]
  });
  
  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  const generationTimeSeconds = Math.round((Date.now() - startTime) / 1000);
  
  return {
    content,
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
    generationTimeSeconds
  };
}

export async function generateGoldenCircle(elia15Content: string, businessNarrativeContent: string): Promise<AIGenerationResult> {
  const startTime = Date.now();

  // Get system prompt from database (with fallback to hardcoded)
  const { getSystemPromptWithFallback } = await import('./SystemPromptService');
  const systemPrompt = await getSystemPromptWithFallback('golden_circle');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `${systemPrompt}\n\nContext:\n- ELIA15 explanation:\n${elia15Content}\n\n- Business Narrative:\n${businessNarrativeContent}`
    }]
  });
  
  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  const generationTimeSeconds = Math.round((Date.now() - startTime) / 1000);
  
  return {
    content,
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
    generationTimeSeconds
  };
}
