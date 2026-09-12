# Cosmic Navigator coordinate and fixed-star contract

Status: normative for `csg-natal-navigator-v1`
Scope: verified natal bodies and the eight committed named stars

## 1. Common target frame

Every verified body and named-star direction is expressed on fixed **ICRS axes aligned to J2000.0**, propagated or calculated for the exact saved birth instant. The observation epoch is the birth instant; the axis orientation does not precess with that date.

| Property | Contract value |
| --- | --- |
| Origin | Geocenter (not topocentric) |
| Coordinate type | Equatorial right ascension and declination |
| Reference | ICRS, J2000.0-aligned fixed axes |
| Position type | Astrometric |
| Light-time | Retained |
| Annual aberration | Omitted |
| Solar gravitational deflection | Omitted |
| Nutation | Omitted |
| Observation epoch | Canonical UTC ISO instant from the saved birth anchor |
| RA range | `0 <= RA < 360` degrees |
| Declination range | `-90 <= Dec <= 90` degrees |

This is not an apparent place, local horizon coordinate, equinox-of-date coordinate, or topocentric direction. Latitude and longitude remain validated parts of the saved chart anchor but do not alter this geocentric direction.

`NAVIGATOR_FRAME_BASE` in `coordinates.ts` is the machine-readable authority. A payload adds its canonical ISO birth instant as `epoch`. Frame comparison is exact and fails on any differing field, including epoch.

## 2. Swiss Ephemeris path

Natal planets are requested through `swe_calc_ut(tjd_ut, bodyId, 138850)`. Flag `138850` is the bitwise OR of:

| Flag | Value | Effect used here |
| --- | ---: | --- |
| `SEFLG_SWIEPH` | 2 | Swiss ephemeris source |
| `SEFLG_J2000` | 32 | fixed J2000 axis orientation rather than equinox of date |
| `SEFLG_NONUT` | 64 | mean, not true, equator/equinox of date |
| `SEFLG_NOGDEFL` | 512 | omit solar deflection |
| `SEFLG_NOABERR` | 1024 | omit annual aberration |
| `SEFLG_EQUATORIAL` | 2048 | equatorial rather than ecliptic output |
| `SEFLG_XYZ` | 4096 | Cartesian rather than angular output |
| `SEFLG_ICRS` | 131072 | ICRS rather than dynamical-J2000 frame |

The returned Cartesian axes are conventional ICRS equatorial axes: `+X` points to RA 0h on the equator, `+Y` to RA 6h on the equator, and `+Z` to the north celestial pole. `SEFLG_J2000 | SEFLG_ICRS` prevents both equinox-of-date precession and the ICRS/dynamical-J2000 frame-bias mismatch. The application only normalizes the returned direction and changes axes for the scene.

A Swiss result is accepted only if its return flags retain the selected Swiss source and every required frame/correction bit, and its first three values are finite and non-zero.

## 3. Saved civil-time anchor

The navigator reads the owned saved chart's civil date, wall-clock time, IANA timezone, latitude, longitude, and `unknown_time` value. It:

1. rejects missing or out-of-range anchor fields;
2. rejects `unknown_time` rather than estimating an instant;
3. enumerates applicable IANA offsets and requires exactly one UTC instant matching the saved wall time;
4. rejects DST gaps and folds as nonexistent or ambiguous;
5. serializes that instant as canonical ISO UTC; and
6. calculates `tjd_ut = unixMilliseconds / 86400000 + 2440587.5`.

The same `tjd_ut` is supplied to Swiss and converted to a Julian epoch for fixed-star motion/precession by `J = 2000 + (JD - 2451545.0) / 365.25`. The ISO instant and Julian day must agree within `1e-8` day; otherwise star serialization fails closed.

## 4. Scene axes and pure conversions

The Three.js scene is right-handed and **Y-up**:

```text
x =  cos(dec) cos(ra)
y =  sin(dec)
z = -cos(dec) sin(ra)
```

Therefore RA 0h maps to scene `+X`, RA 6h maps to scene `-Z`, and the north celestial pole maps to scene `+Y`.

For conventional Swiss equatorial Cartesian `(Xeq, Yeq, Zeq)`, the axis-only scene conversion is:

```text
(Xscene, Yscene, Zscene) = normalize(Xeq, Zeq, -Yeq)
```

All conversion utilities are pure. They reject non-finite values, declinations outside `[-90, 90]`, and zero Cartesian vectors. Returned scene vectors are normalized; the calculation/test tolerance is absolute length error `<= 1e-12`.

## 5. Fixed-star catalog and fixed-axis epoch propagation

`starCatalog.ts` commits exactly eight Hipparcos-2 records in product order:

1. Sirius — HIP 32349
2. Betelgeuse — HIP 27989
3. Rigel — HIP 24436
4. Aldebaran — HIP 21421
5. Polaris — HIP 11767
6. Vega — HIP 91262
7. Antares — HIP 80763
8. Capella — HIP 24608

Authority: **Hipparcos, the New Reduction**, CDS/VizieR `I/311/hip2`, iteration-14 astrometric catalogue (van Leeuwen 2007). Stored positions are the source table's radians in ICRS at catalog epoch J1991.25. Proper motions are milliarcseconds per Julian year; `pmRA` is `mu_alpha* = d(alpha)/dt cos(delta)`. The source URL, retrieval date, units, downloaded-archive SHA-256, exact raw-row SHA-256, and canonical selected-subset SHA-256 are committed in `STAR_CATALOG_PROVENANCE`.

The exact fixed-width source rows are retained in `data/astronomy/hipparcos2-named-stars.raw.txt`. `scripts/extract_hip2_named_stars.py` verifies the pinned downloaded archive and deterministically regenerates both that file and `data/astronomy/hipparcos2-named-stars.canonical.csv`.

Independent planet/star expectations are committed in `data/astronomy/cosmic-navigator-independent-fixtures.json` and regenerated by `node scripts/generate_navigator_reference_fixtures.mjs`. The fixture generator calls Swiss Ephemeris directly and performs independent tangent-plane arithmetic; it does not import a production Navigator transform.

The deterministic transform is:

```text
Hipparcos position at J1991.25 in fixed ICRS
  -> tangent-plane proper-motion propagation to target Julian epoch
  -> no precession (ICRS axes stay fixed)
  -> RA/Dec validation
  -> normalized Y-up scene vector
```

The observation epoch J1991.25 is not treated as a mean equinox. The production star path performs no precession, matching the Swiss `SEFLG_J2000 | SEFLG_ICRS` output directly and avoiding both double-precession and model mismatch. No runtime request is made to VizieR, CDS, SIMBAD, Gaia, NASA, or any other catalog.

`precessMeanEquatorial` remains a tested general-purpose pure utility, but the v1 production contract intentionally does not call it. This is explicit rather than silently assuming Swiss's current precession model or ignoring ICRS frame bias.

The exact canonical selected-source bytes are committed at `data/astronomy/hipparcos2-named-stars.canonical.csv`, sorted by HIP number with UTF-8/LF rows formatted as `HIP,RA_rad_10dp,Dec_rad_10dp,pmRA_2dp,pmDec_2dp`. Tests recompute its SHA-256 and independently compare every production record to the parsed artifact.

## 6. Body ordering

Primary bodies, exactly: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto.

Additional bodies, exactly: Chiron, Juno, True North Node. These are optional and never reorder or invalidate the ten-primary set when an optional ephemeris record is unavailable.

## 7. Precision and presentation

Calculations retain JavaScript double precision. Catalog radians and proper motions retain the exact published precision committed in the local records. API values are not rounded for display.

Presentation rounding is separate and must not be written back into calculation values. A UI may format RA/Dec for readability, but selection, comparison, scene placement, validation, and serialization use the unrounded values.

## 8. Fail-closed rules

A verified direction is unavailable if RA, declination, epoch, frame metadata, or any vector component is non-finite or out of range; if a vector is zero/non-unit beyond tolerance; or if frame/epoch metadata differs. Required natal-body failure suppresses the verified natal overlay. Optional-body failure omits only that optional marker. No zero, stale, sentinel, or fabricated direction is emitted.
