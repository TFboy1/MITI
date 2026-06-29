export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Do NOT set crossOrigin to prevent CORS blocking for same-origin dev server files
    img.src = url;
    img.onload = () => {
      console.log('Successfully loaded particle image:', url);
      resolve(img);
    };
    img.onerror = (e) => {
      console.error('Failed to load particle image:', url, e);
      reject(e);
    };
  });
}

/**
 * Samples a combined state of a character silhouette (on the left) and text (on the right).
 * Color is set uniformly to the character's theme color.
 */
export async function sampleCombinedState(imgUrl, text, count, themeColorHex, imageSplit = 8000) {
  const textSplit = count - imageSplit;
  
  // 1. Sample Character Image Silhouette from transparent PNG
  const img = await loadImage(imgUrl);
  const aspect = img.width / img.height;
  
  // High resolution for clear silhouette contours
  const imgSize = 220;
  const canvasWidth = imgSize;
  const canvasHeight = Math.round(imgSize / aspect);
  
  const imgCanvas = document.createElement('canvas');
  imgCanvas.width = canvasWidth;
  imgCanvas.height = canvasHeight;
  const imgCtx = imgCanvas.getContext('2d');
  imgCtx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
  const imgData = imgCtx.getImageData(0, 0, canvasWidth, canvasHeight);
  const imgPixels = [];
  
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      const idx = (y * canvasWidth + x) * 4;
      const r = imgData.data[idx];
      const g = imgData.data[idx + 1];
      const b = imgData.data[idx + 2];
      
      // JPG has no alpha channel, so key out the solid white background instead
      const isWhiteBg = r > 245 && g > 245 && b > 245;
      if (!isWhiteBg) {
        imgPixels.push({ x, y });
      }
    }
  }
  
  // Fallback if image has no transparent pixels
  if (imgPixels.length === 0) {
    for (let y = 0; y < canvasHeight; y += 2) {
      for (let x = 0; x < canvasWidth; x += 2) {
        imgPixels.push({ x, y });
      }
    }
  }
  
  // 2. Sample Text Shape
  const textCanvasWidth = 750;
  const textCanvasHeight = 280;
  const textCanvas = document.createElement('canvas');
  textCanvas.width = textCanvasWidth;
  textCanvas.height = textCanvasHeight;
  const textCtx = textCanvas.getContext('2d');
  textCtx.fillStyle = '#000000';
  textCtx.fillRect(0, 0, textCanvasWidth, textCanvasHeight);
  
  textCtx.fillStyle = '#ffffff';
  textCtx.textAlign = 'center';
  textCtx.textBaseline = 'middle';
  
  const lines = text.split('\n');
  const fontSize = lines.length > 1 ? 52 : 68;
  textCtx.font = `bold ${fontSize}px "Inter", "Outfit", "Microsoft YaHei", sans-serif`;
  const lineHeight = fontSize * 1.35;
  const startY = textCanvasHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    textCtx.fillText(line, textCanvasWidth / 2, startY + index * lineHeight);
  });
  
  const textData = textCtx.getImageData(0, 0, textCanvasWidth, textCanvasHeight);
  const textPixels = [];
  for (let y = 0; y < textCanvasHeight; y++) {
    for (let x = 0; x < textCanvasWidth; x++) {
      const idx = (y * textCanvasWidth + x) * 4;
      if (textData.data[idx] > 120) {
        textPixels.push({ x, y });
      }
    }
  }
  
  if (textPixels.length === 0) {
    for (let i = 0; i < 500; i++) {
      textPixels.push({
        x: textCanvasWidth / 2 + (Math.random() - 0.5) * 200,
        y: textCanvasHeight / 2 + (Math.random() - 0.5) * 50
      });
    }
  }
  
  // 3. Assemble coordinates and color values
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  
  // Theme color parsing
  const hex = themeColorHex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Dimensions and alignment offsets in Three.js unit coordinate space
  const targetWidth = 90;
  const targetHeight = targetWidth / aspect;
  const imageOffsetX = -36; // Place silhouette on the left side
  const imageOffsetY = 0;
  
  const textScaleWidth = 95;
  const textScaleHeight = (textScaleWidth * textCanvasHeight) / textCanvasWidth;
  const textOffsetX = 32; // Place text on the right side
  
  // Sample Character Silhouette points
  for (let i = 0; i < imageSplit; i++) {
    const pixelIdx = Math.floor((i / imageSplit) * imgPixels.length);
    const pixel = imgPixels[pixelIdx];
    
    const xNoise = (Math.random() - 0.5) * 0.35;
    const yNoise = (Math.random() - 0.5) * 0.35;
    const zVal = (Math.random() - 0.5) * 3.0; // Subtle volumetric depth
    
    positions[i * 3] = ((pixel.x + xNoise) / canvasWidth - 0.5) * targetWidth + imageOffsetX;
    positions[i * 3 + 1] = (0.5 - (pixel.y + yNoise) / canvasHeight) * targetHeight + imageOffsetY;
    positions[i * 3 + 2] = zVal;
    
    // Assign uniform theme color
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  
  // Sample Text points
  for (let i = 0; i < textSplit; i++) {
    const pixelIdx = Math.floor((i / textSplit) * textPixels.length);
    const pixel = textPixels[pixelIdx];
    const targetIdx = imageSplit + i;
    
    const xNoise = (Math.random() - 0.5) * 0.4;
    const yNoise = (Math.random() - 0.5) * 0.4;
    const zVal = (Math.random() - 0.5) * 2.0;
    
    positions[targetIdx * 3] = ((pixel.x + xNoise) / textCanvasWidth - 0.5) * textScaleWidth + textOffsetX;
    positions[targetIdx * 3 + 1] = (0.5 - (pixel.y + yNoise) / textCanvasHeight) * textScaleHeight;
    positions[targetIdx * 3 + 2] = zVal;
    
    // Assign same theme color for text particles
    colors[targetIdx * 3] = r;
    colors[targetIdx * 3 + 1] = g;
    colors[targetIdx * 3 + 2] = b;
  }
  
  return { positions, colors };
}
