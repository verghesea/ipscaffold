import { supabaseAdmin } from '../lib/supabase';

export interface ProgressUpdate {
  patentId: string;
  stage: 'artifacts' | 'hero_image' | 'section_images';
  current: number;
  total: number;
  message: string;
  complete: boolean;
}

// In-memory store for SSE connections
const progressStore = new Map<string, ProgressUpdate>();

export async function updateProgress(update: ProgressUpdate): Promise<void> {
  progressStore.set(update.patentId, update);

  // Persist to database
  const { error } = await supabaseAdmin
    .from('patent_progress')
    .upsert({
      patent_id: update.patentId,
      stage: update.stage,
      current: update.current,
      total: update.total,
      message: update.message,
      complete: update.complete,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'patent_id' });

  if (error) {
    console.error('Failed to persist progress:', error);
  }
}

export function getProgress(patentId: string): ProgressUpdate | null {
  return progressStore.get(patentId) || null;
}

export function clearProgress(patentId: string): void {
  progressStore.delete(patentId);
}

export async function getProgressFromDb(patentId: string): Promise<ProgressUpdate | null> {
  const { data, error } = await supabaseAdmin
    .from('patent_progress')
    .select('*')
    .eq('patent_id', patentId)
    .single();

  if (error || !data) return null;

  return {
    patentId: data.patent_id,
    stage: data.stage,
    current: data.current,
    total: data.total,
    message: data.message,
    complete: data.complete,
  };
}
