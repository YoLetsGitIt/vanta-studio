// Match the CSS/picture breakpoint: narrower windows need the camera that
// keeps the entrance frame and handle inside the horizontal crop.
export const NARROW_SCENE_MEDIA = '(max-aspect-ratio: 8/5)';
export const sceneVariant = (width, height) => width / height <= 8 / 5 ? 'portrait' : 'landscape';
