// ?season=winter switches the forest to its bare, snow-dusted look (default is autumn)
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('season') : null;
export const SEASON = q === 'winter' ? 'winter' : 'autumn';
export const IS_WINTER = SEASON === 'winter';

// What is actually about at this time of year (eastern Massachusetts):
//  autumn: everything is out; geese and hawks are migrating, herons linger until the first hard freeze, painted turtles still bask on warm days
//  winter: herons have left, turtles are in the mud, fish sit deep and out of sight, floating geese want open water; squirrels, chickadees, jays, hawks and passing geese remain
export const WILDLIFE = IS_WINTER
  ? { fish: false, turtles: false, heron: false, floatingGeese: false, geese: true, hawk: true, songbirds: true, squirrels: true, squirrelRate: 1.8 }
  : { fish: true, turtles: true, heron: true, floatingGeese: true, geese: true, hawk: true, songbirds: true, squirrels: true, squirrelRate: 1 };
