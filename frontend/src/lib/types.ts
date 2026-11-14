export interface SiteStats {
  sunlight_pct: number;
  dte_pct: number;
  sun_and_dte_pct: number;
  max_solar_elev_deg: number;
  min_solar_elev_deg: number;
  earth_elev_range_deg: [number, number];
  mean_power_eff_horizontal: number;
  mean_power_eff_vertical_tracking: number;
  max_continuous_shadow_h: number;
  max_continuous_sunlight_h: number;
  mean_daylight_period_days: number | null;
  mean_night_period_days: number | null;
  complete_daylight_periods: number;
  max_continuous_dte_blackout_h: number;
  max_horizon_deg: number;
  mean_horizon_deg: number;
}

export interface SnapInfo {
  mode: "max" | "min";
  radius_km: number;
  note: string;
  shift_km: number;
  bearing_deg: number;
  hit_search_edge: boolean;
  applied?: boolean;
}

export interface SiteMeta {
  id: string;
  name: string;
  agency: string;
  region: string;
  description: string;
  coord_source?: string | null;
  slope_deg: number | null;
  warnings: string[];
  lat: number;
  lon: number;
  catalog_lat: number;
  catalog_lon: number;
  snap: SnapInfo | null;
  elev_km_catalog: number | null;
  elev_km_dem: number | null;
  elev_km_used: number;
  horizon_source: string;
  stats: SiteStats;
  horizon_mask_deg: number[];
  file: string;
}

export interface SitesIndex {
  generated_utc: string;
  time_range_utc: [string, string];
  step_h: number;
  ephemeris_source: string;
  dem: { file: string; crs: string; pixel_m: number; shape: [number, number]; dn_scale_m: number };
  trace_km: number;
  observer_mast_m: number;
  sites: SiteMeta[];
}

export interface BodySeries {
  az: number[];
  el: number[];
  vis: number[];
  t_set: (number | null)[];
  t_rise: (number | null)[];
}

export interface SunSeries extends BodySeries {
  pwr: number[];
  pwr_v: number[];
}

export interface SiteDetail extends Omit<SiteMeta, "file"> {
  horizon_mask_dist_km: number[];
  time: { start_utc: string; step_h: number; n: number };
  sun: SunSeries;
  earth: BodySeries;
}

export type Audience = "planner" | "explorer";
