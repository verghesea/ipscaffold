/**
 * Custom hook for managing section images
 * Handles fetching, generation, and regeneration of images
 */

import { useState, useEffect, useCallback } from 'react';
import { api, type SectionImage, type GenerateImagesResult } from '@/lib/api';

interface UseSectionImagesReturn {
  images: SectionImage[];
  loading: boolean;
  generating: boolean;
  error: string | null;
  generateImages: () => Promise<GenerateImagesResult | null>;
  regenerateImage: (sectionNumber: number) => Promise<SectionImage | null>;
  refreshImages: () => Promise<void>;
}

export function useSectionImages(artifactId: string | undefined): UseSectionImagesReturn {
  const [images, setImages] = useState<SectionImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImages = useCallback(async () => {
    if (!artifactId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api.getSectionImages(artifactId);
      setImages(data);
    } catch (err) {
      setError((err as Error).message);
      console.error('Error fetching section images:', err);
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  // Fetch images when artifact ID changes
  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const generateImages = useCallback(async () => {
    if (!artifactId) return null;

    setGenerating(true);
    setError(null);

    try {
      const result = await api.generateSectionImages(artifactId);

      if (result.success) {
        setImages(result.sectionImages);
      }

      return result;
    } catch (err) {
      setError((err as Error).message);
      console.error('Error generating images:', err);
      return null;
    } finally {
      setGenerating(false);
    }
  }, [artifactId]);

  const regenerateImage = useCallback(async (sectionNumber: number) => {
    if (!artifactId) return null;

    try {
      const newImage = await api.regenerateSectionImage(artifactId, sectionNumber);

      // Update images array by replacing the old image with the new one
      setImages(prev => {
        const filtered = prev.filter(img => img.section_number !== sectionNumber);
        return [...filtered, newImage].sort((a, b) => a.section_number - b.section_number);
      });

      return newImage;
    } catch (err) {
      setError((err as Error).message);
      console.error('Error regenerating image:', err);
      return null;
    }
  }, [artifactId]);

  return {
    images,
    loading,
    generating,
    error,
    generateImages,
    regenerateImage,
    refreshImages: fetchImages,
  };
}
