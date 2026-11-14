# NASA JPL Horizons REST API Specification

## Endpoint
`GET https://ssd.jpl.nasa.gov/api/horizons.api`

## Query Parameters for Lunar Topocentric Observer
- `format`: `'json'`
- `COMMAND`: `'10'` for Sun, `'399'` for Earth
- `OBJ_DATA`: `'NO'`
- `MAKE_EPHEM`: `'YES'`
- `EPHEM_TYPE`: `'OBSERVER'`
- `CENTER`: `'coord@301'` (301 = Moon body center)
- `COORD_TYPE`: `'GEODETIC'`
- `SITE_COORD`: `'{lon},{lat},{elev_km}'` (Note: East Longitude in 0..360 or -180..180, Latitude in -90..90, Elevation in km relative to 1737.4 km reference sphere)
- `START_TIME`: `'2026-01-01'`
- `STOP_TIME`: `'2028-01-01'`
- `STEP_SIZE`: `'1h'` (or `'2h'` to keep file sizes compact)
- `QUANTITIES`: `'4'` (Apparent Azimuth & Elevation in degrees)
- `ANG_FORMAT`: `'DEG'`

## Parsing Rules (CRITICAL)
1. The API returns a JSON object where `response.json()["result"]` is a multi-line string.
2. Extract lines strictly between the `$$SOE` (Start of Ephemeris) and `$$EOE` (End of Ephemeris) markers.
3. Each line inside `$$SOE`..`$$EOE` follows the format:
   `YYYY-Mon-DD HH:MM     Azi_(a-app)   Elev_(a-app)`
   (Note: Sometimes solar/lunar presence flags like `*`, `m`, `t` appear between the timestamp and Azimuth—parse tokens safely using regex or splitting from the right: the last two float numbers on each line are always `azimuth_deg` and `elevation_deg`).
4. Respect rate limits: Add `time.sleep(0.5)` between API requests and cache raw API responses locally in `raw_data/cache/` so re-runs never re-fetch.