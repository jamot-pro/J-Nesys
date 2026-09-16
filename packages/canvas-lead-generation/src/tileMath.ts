/**
 * Slippy-map tile math (the same projection OpenStreetMap/Google/etc. use).
 * No API key needed — this is just the standard Web Mercator tiling formula.
 * https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Fractional tile X for a longitude at a given zoom (not rounded — keeps sub-tile precision). */
export function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * 2 ** zoom;
}

/** Fractional tile Y for a latitude at a given zoom. */
export function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** zoom;
}

export function tileXToLng(x: number, zoom: number): number {
  return (x / 2 ** zoom) * 360 - 180;
}

export function tileYToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/** Meters per pixel at a given latitude/zoom — needed to draw a radius circle to true scale. */
export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** Picks a zoom level where a `radiusKm` circle renders at a sane size on a `viewportPx`-wide map. */
export function zoomForRadius(radiusKm: number, lat: number, viewportPx: number): number {
  const targetPixelRadius = viewportPx * 0.32; // circle comfortably inside the visible area
  const radiusMeters = radiusKm * 1000;
  for (let zoom = 14; zoom >= 3; zoom--) {
    const pixelRadius = radiusMeters / metersPerPixel(lat, zoom);
    if (pixelRadius <= targetPixelRadius) return zoom;
  }
  return 3;
}

/** Converts a pixel offset from the map center back into a lat/lng, given the current center/zoom. */
export function pixelOffsetToLatLng(
  center: LatLng,
  zoom: number,
  dxPx: number,
  dyPx: number,
): LatLng {
  const centerTileX = lngToTileX(center.lng, zoom);
  const centerTileY = latToTileY(center.lat, zoom);
  const tileX = centerTileX + dxPx / 256;
  const tileY = centerTileY + dyPx / 256;
  return { lat: tileYToLat(tileY, zoom), lng: tileXToLng(tileX, zoom) };
}

/** The inverse: where on screen (relative to center) a lat/lng falls, in pixels. */
export function latLngToPixelOffset(
  center: LatLng,
  zoom: number,
  point: LatLng,
): { dx: number; dy: number } {
  const centerTileX = lngToTileX(center.lng, zoom);
  const centerTileY = latToTileY(center.lat, zoom);
  const tileX = lngToTileX(point.lng, zoom);
  const tileY = latToTileY(point.lat, zoom);
  return { dx: (tileX - centerTileX) * 256, dy: (tileY - centerTileY) * 256 };
}

/** Top-left tile coordinates (integer) for a grid of `count x count` tiles centered on `center`. */
export function centeredTileGrid(center: LatLng, zoom: number, count: number) {
  const centerTileX = lngToTileX(center.lng, zoom);
  const centerTileY = latToTileY(center.lat, zoom);
  const half = Math.floor(count / 2);
  const originTileX = Math.floor(centerTileX) - half;
  const originTileY = Math.floor(centerTileY) - half;
  // Pixel offset of the grid's top-left corner relative to the viewport center.
  const offsetX = (originTileX - centerTileX) * 256;
  const offsetY = (originTileY - centerTileY) * 256;
  return { originTileX, originTileY, offsetX, offsetY };
}
