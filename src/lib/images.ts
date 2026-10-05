export const defaultProductImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FCF9F6" />
          <stop offset="100%" stop-color="#F2E8DF" />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="url(#bg)" />
      <g transform="translate(130, 130)" fill="none" stroke="#C59B27" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="35 18 105 18 128 52 70 122 12 52 35 18" fill="#D4AF37" fill-opacity="0.18" />
        <polyline points="12 52 70 122 128 52" />
        <polyline points="35 18 70 52 105 18" />
        <line x1="12" y1="52" x2="128" y2="52" />
        <line x1="70" y1="52" x2="70" y2="122" />
      </g>
    </svg>`,
  );

export function fallbackFor(_slug?: string | null) {
  return defaultProductImage;
}
