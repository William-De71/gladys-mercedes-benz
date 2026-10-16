// -----------------------------------------------------------------------------
// Where the car is relative to the houses of Gladys.
//
// The houses come from `getHouses()` (manifest `location: true`); a house
// without coordinates is ignored. "Home" is the nearest located house. Being
// home uses a small hysteresis: a car parked right at the edge of the radius,
// whose GPS fix wanders a few meters, must not arrive and leave every round.
// -----------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371.0088;
// Leaving needs 25 % more than the radius.
const LEAVE_FACTOR = 1.25;

/**
 * @description The great-circle distance between two points.
 * @param {{ latitude: number, longitude: number }} a - A point.
 * @param {{ latitude: number, longitude: number }} b - Another point.
 * @returns {number} The distance, in km.
 * @example
 * distanceKm({ latitude: 48.8584, longitude: 2.2945 }, { latitude: 48.8606, longitude: 2.3376 }); // -> ≈ 3.2
 */
function distanceKm(a, b) {
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * @description The located houses.
 * @param {Array<object>} houses - The houses of Gladys.
 * @returns {Array<{ name: string, latitude: number, longitude: number }>} The houses with coordinates.
 */
function locatedHouses(houses) {
  return (Array.isArray(houses) ? houses : []).filter(
    (house) =>
      Number.isFinite(house?.latitude) &&
      Number.isFinite(house?.longitude) &&
      !(house.latitude === 0 && house.longitude === 0),
  );
}

/**
 * @description The nearest located house of a position.
 * @param {{ latitude: number, longitude: number }|null} position - The position.
 * @param {Array<object>} houses - The houses of Gladys.
 * @returns {{ house: object, distanceKm: number }|null} The nearest one.
 * @example
 * nearestHouse(snapshot.location, houses);
 */
function nearestHouse(position, houses) {
  if (!position) {
    return null;
  }
  let best = null;
  locatedHouses(houses).forEach((house) => {
    const distance = distanceKm(position, house);
    if (!best || distance < best.distanceKm) {
      best = { house, distanceKm: distance };
    }
  });
  return best;
}

/**
 * @description Whether the car is home, with the hysteresis.
 * @param {number|null} distance - Distance to the nearest house, in km.
 * @param {number} radiusMeters - The configured radius.
 * @param {boolean|null} wasHome - The previous answer (null: unknown).
 * @returns {boolean|null} The answer, null when the distance is unknown.
 * @example
 * isHome(0.15, 200, false); // -> true
 */
function isHome(distance, radiusMeters, wasHome) {
  if (distance === null || !Number.isFinite(distance)) {
    return null;
  }
  const meters = distance * 1000;
  if (wasHome === true) {
    return meters <= radiusMeters * LEAVE_FACTOR;
  }
  return meters <= radiusMeters;
}

/**
 * @description A link to the position on OpenStreetMap.
 * @param {{ latitude: number, longitude: number }} position - The position.
 * @returns {string} The URL.
 * @example
 * mapUrl({ latitude: 57.725, longitude: 11.85 });
 * // -> 'https://www.openstreetmap.org/?mlat=57.72500&mlon=11.85000#map=17/57.72500/11.85000'
 */
function mapUrl(position) {
  const lat = position.latitude.toFixed(5);
  const lon = position.longitude.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}

export { distanceKm, locatedHouses, nearestHouse, isHome, mapUrl };
