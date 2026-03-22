// Sprite renderer for 16x24 pixel art characters
// Loads sprite JSON data and renders to canvas

const SPRITE_SCALE = 2; // Scale up 2x for better visibility

class SpriteRenderer {
  constructor() {
    this.sprites = {};
    this.loaded = false;
  }

  async loadSprite(name, url) {
    try {
      const response = await fetch(url);
      const data = await response.json();
      this.sprites[name] = data;
      console.log(`[sprite] Loaded ${name} (${data.width}x${data.height})`);
    } catch (err) {
      console.error(`[sprite] Failed to load ${name}:`, err.message);
    }
  }

  async loadAll() {
    await Promise.all([
      this.loadSprite('brandon', 'sprites/brandon.json'),
      this.loadSprite('sophie', 'sprites/sophie.json'),
      this.loadSprite('jake', 'sprites/jake.json'),
    ]);
    this.loaded = true;
    console.log('[sprite] All sprites loaded');
  }

  draw(ctx, name, x, y, frame = 0, flip = false) {
    const sprite = this.sprites[name];
    if (!sprite) {
      // Fallback to procedural drawing
      return false;
    }

    const { width, height, pixels } = sprite;
    const scale = SPRITE_SCALE;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const pixelData = pixels[row][col];
        
        // Handle both array [R,G,B] and string "#RRGGBB" formats
        let color;
        if (Array.isArray(pixelData)) {
          const [r, g, b] = pixelData;
          if (r === 255 && g === 255 && b === 255) continue; // Skip white (transparent)
          color = `rgb(${r},${g},${b})`;
        } else if (typeof pixelData === 'string') {
          if (pixelData === '#FFFFFF') continue; // Skip white
          color = pixelData;
        } else {
          continue;
        }

        const drawX = flip ? x + (width - col - 1) * scale : x + col * scale;
        const drawY = y + row * scale;

        ctx.fillStyle = color;
        ctx.fillRect(Math.floor(drawX), Math.floor(drawY), scale, scale);
      }
    }

    return true;
  }

  getSprite(name) {
    return this.sprites[name] || null;
  }
}

// Global sprite renderer instance
export const spriteRenderer = new SpriteRenderer();

export default spriteRenderer;
