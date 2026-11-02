import { STUDIO_FEATURE_CATALOG } from '@/lib/studioFeatureCatalog';
import { ARTIST_FEATURE_CATALOG } from '@/lib/artistFeatureCatalog';

// Use the exact feature names, descriptions and demos from the shared product catalogue.
// This adapter only supplies the walkthrough's presentation fields.
const present = (product, portrait) => feature => {
  const media = feature.media || [
    ...(feature.videos || (feature.video ? [feature.video] : [])).map(src => ({ type: 'video', src })),
    ...feature.images.map(src => ({ type: 'image', src })),
  ];
  return {
    ...feature,
    teaser: feature.summary || feature.desc,
    intro: feature.desc,
    points: feature.detail || [],
    screens: media.map((item, index) => ({
      ...item,
      label: item.title || `${item.type === 'video' ? 'Demo' : 'Preview'}${media.length > 1 ? ` ${index + 1}` : ''}`,
      alt: `${feature.title} in ${product}`,
    })),
    portrait,
  };
};
export const STUDIO_FEATURES = STUDIO_FEATURE_CATALOG.map(present('Vanta Studio', false));
// Artist features are illustrated with phone captures from the Vanta app.
export const ARTIST_FEATURES = ARTIST_FEATURE_CATALOG.map(present('the Vanta app', true));
