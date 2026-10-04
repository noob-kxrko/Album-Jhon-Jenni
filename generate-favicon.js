const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outPath = path.join(__dirname, 'public', 'favicon.png');

async function createFavicon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#8f5cf6"/>
          <stop offset="100%" stop-color="#ff8cb4"/>
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx="48" fill="#1b1129"/>
      <rect x="28" y="28" width="200" height="200" rx="36" fill="url(#g)"/>
      <circle cx="96" cy="104" r="32" fill="#fff" opacity="0.95"/>
      <path d="M124 150c18-24 46-36 72-36v30c-16 0-31 6-45 18l-27 18Z" fill="#fff" opacity="0.9"/>
      <path d="M62 148c18-25 52-40 90-40v28c-28 0-54 9-74 27l-16-15Z" fill="#f8ebff" opacity="0.8"/>
      <text x="128" y="208" text-anchor="middle" font-size="28" fill="#ffffff" font-family="Arial, sans-serif" font-weight="700">J&amp;J</text>
    </svg>
  `;

  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(outPath);
  console.log('Favicon generado:', outPath);
}

createFavicon().catch((error) => {
  console.error(error);
  process.exit(1);
});
