import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const iconSizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = 'client/public/icons';

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('🎨 Generating OlaClick Analytics icons...');

// Generate base 512x512 icon with OlaClick branding
const baseIcon = path.join(iconsDir, 'icon-512x512.png');
const baseCommand = `convert -size 512x512 xc:"#3b82f6" -pointsize 120 -fill white -gravity center -annotate +0+0 "🍔" ${baseIcon}`;

try {
  execSync(baseCommand);
  console.log('✅ Generated base icon (512x512)');
} catch (error) {
  console.error('❌ Error generating base icon:', error.message);
  console.log('📝 Creating simple colored squares as fallback...');
  
  // Fallback: create simple colored squares
  for (const size of iconSizes) {
    const iconPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    const fallbackCommand = `convert -size ${size}x${size} xc:"#3b82f6" ${iconPath}`;
    try {
      execSync(fallbackCommand);
      console.log(`✅ Generated icon-${size}x${size}.png`);
    } catch (err) {
      console.error(`❌ Failed to generate icon-${size}x${size}.png:`, err.message);
    }
  }
  process.exit(0);
}

// Generate all other sizes from the base icon
for (const size of iconSizes) {
  if (size === 512) continue; // Already created
  
  const iconPath = path.join(iconsDir, `icon-${size}x${size}.png`);
  const resizeCommand = `convert ${baseIcon} -resize ${size}x${size} ${iconPath}`;
  
  try {
    execSync(resizeCommand);
    console.log(`✅ Generated icon-${size}x${size}.png`);
  } catch (error) {
    console.error(`❌ Error generating icon-${size}x${size}.png:`, error.message);
  }
}

console.log('🎉 All icons generated successfully!');
console.log('📁 Icons saved to:', iconsDir); 