/**
 * DALL-E 3 Prompts for Section Images
 * Style: Simple 4-color pen sketches (green, red, blue, black)
 * Aesthetic: Quick working notes, minimal detail, hand-drawn
 */

export const DALLE_PROMPTS = {
  elia15: {
    1: `Simple hand-drawn sketch showing cable problem transforming to wireless solution, quick diagram with blue and black pens, left side has tangled curved lines representing cables, right side has simple circular coils with radiating lines, arrow drawn with red pen between them, loose sketchy style, minimal detail, like quick working notes, graph paper background visible, 16:9 aspect ratio`,

    2: `Simple pen sketch of two coils with magnetic field lines between them, quick diagram drawn with blue and black pens, transmitter coil on left (spiral circle), receiver coil on right (spiral circle), curved lines connecting them drawn with green pen showing energy flow, loose sketchy linework, minimal detail, working notes style, graph paper background faintly visible, 16:9 aspect ratio`,

    3: `Quick hand-drawn exploded view sketch showing coil layers separated vertically, simple diagram with blue and black pens, 3-4 circular/rectangular shapes stacked with space between, dashed lines connecting them drawn with red pen, small arrows showing assembly, loose sketchy style, very simple and minimal, like quick working sketch, graph paper background visible, 16:9 aspect ratio`,

    4: `Simple before-and-after comparison sketch, quick diagram with colored pens, left side labeled "OLD" shows messy scribbled lines in black, right side labeled "NEW" shows clean simple coil circle in blue with green radiating lines, red arrow pointing from left to right, very simple loose sketch, minimal detail, working notes style, graph paper background, 16:9 aspect ratio`,

    5: `Simple network sketch showing center hub with connections to surrounding nodes, quick diagram with blue and green pens, central circle (transmitter) with straight lines radiating out to 5-6 smaller circles (devices), drawn with loose sketchy lines, minimal detail, like quick working diagram, small icons or simple shapes for devices, graph paper background visible, 16:9 aspect ratio`,
  },

  business_narrative: {
    1: `Simple sketch showing infrastructure problem, quick diagram with red and black pens, geometric shapes with X marks and broken lines, disconnected boxes with gaps between them, rough sketchy style, minimal detail, working notes aesthetic, shows barriers or breaks simply, graph paper background visible, 16:9 aspect ratio`,

    2: `Simple pen sketch of solution concept, clean diagram with blue and green pens, central coil circle with organized radiating field lines, neat but still hand-drawn, minimal detail, shows elegance through simplicity, working sketch style, graph paper background, 16:9 aspect ratio`,

    3: `Simple growth diagram, quick sketch with blue and green pens, concentric circles expanding outward from center, drawn freehand with loose lines, minimal detail, shows expansion simply, working notes style, graph paper background visible, 16:9 aspect ratio`,
  },

  golden_circle: {
    1: `Simple sketch of core purpose concept, quick diagram with blue and green pens, central circle with radiating lines spreading outward, drawn with loose freehand circles, minimal detail, shows core with expanding influence simply, working notes aesthetic, graph paper background, 16:9 aspect ratio`,

    2: `Simple process sketch showing connected elements, quick diagram with blue and black pens, 3-4 circles or boxes connected by arrows, shows flow simply, loose sketchy linework, minimal detail, working notes style, graph paper background visible, 16:9 aspect ratio`,

    3: `Simple product sketch, quick diagram with blue and black pens, basic geometric shape representing device, minimal detail, clean simple lines but still hand-drawn, shows what it is simply, working notes aesthetic, graph paper background, 16:9 aspect ratio`,
  },
} as const;

export type ArtifactType = keyof typeof DALLE_PROMPTS;
export type SectionNumber<T extends ArtifactType> = keyof typeof DALLE_PROMPTS[T];

/**
 * Get the prompt for a specific artifact section
 */
export function getPromptForSection(
  artifactType: ArtifactType,
  sectionNumber: number
): string | null {
  const prompts = DALLE_PROMPTS[artifactType];
  if (!prompts) return null;

  return (prompts as any)[sectionNumber] || null;
}

/**
 * Get the total number of sections for an artifact type
 */
export function getSectionCount(artifactType: ArtifactType): number {
  return Object.keys(DALLE_PROMPTS[artifactType]).length;
}
