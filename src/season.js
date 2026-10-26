// ?season=winter switches the forest to its bare, snow-dusted look (default is autumn)
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('season') : null;
export const SEASON = q === 'winter' ? 'winter' : 'autumn';
export const IS_WINTER = SEASON === 'winter';
