// Privacy-first analytics (spec section 15): no cookies, no stored IPs, no
// cross-site or cross-day tracking. "Unique visitors" use a hash of
// IP + user agent + project + the current date + a server secret — the IP is
// only an input to the hash, never stored, and the hash rotates every day so
// a visitor can't be followed across days.

import crypto from "node:crypto";
import type { AnalyticsEventDoc } from "./firestore";

export type Device = AnalyticsEventDoc["device"];

const BOT_RE = /bot|crawl|spider|slurp|preview|monitor|headless|curl|wget|python-requests|lighthouse/i;

export function isBot(ua: string): boolean {
  return !ua || BOT_RE.test(ua);
}

export function parseUserAgent(ua: string): { device: Device; browser: string } {
  const device: Device = /ipad|tablet/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "mobile" : "desktop";
  let browser = "Other";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua)) browser = "Safari";
  return { device, browser };
}

/** Referrer host, or null for direct traffic / same-site navigation. */
export function referrerHost(referer: string | null, ownHost: string | null): string | null {
  if (!referer) return null;
  try {
    const host = new URL(referer).hostname.replace(/^www\./, "");
    if (!host || (ownHost && host === ownHost.split(":")[0].replace(/^www\./, ""))) return null;
    return host;
  } catch {
    return null;
  }
}

export function visitorHash(p: { ip: string; ua: string; projectId: string; date: string; secret: string }): string {
  return crypto.createHash("sha256").update(`${p.secret}|${p.date}|${p.projectId}|${p.ip}|${p.ua}`).digest("hex").slice(0, 32);
}

export function pagePathFor(filePath: string): string {
  return filePath === "index.html" ? "/" : `/${filePath}`;
}

type Counted = { key: string; count: number };

function topN(map: Map<string, number>, n: number): Counted[] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));
}

export type AnalyticsSummary = {
  pageViews: number;
  uniqueVisitors: number;
  topPages: Counted[];
  referrers: Counted[];
  countries: Counted[];
  devices: Counted[];
  browsers: Counted[];
};

export function aggregateEvents(events: AnalyticsEventDoc[]): AnalyticsSummary {
  const maps = { pages: new Map<string, number>(), refs: new Map<string, number>(), countries: new Map<string, number>(), devices: new Map<string, number>(), browsers: new Map<string, number>() };
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  const visitors = new Set<string>();
  for (const e of events) {
    visitors.add(e.visitor);
    bump(maps.pages, e.path);
    bump(maps.refs, e.referrer ?? "Direct / none");
    bump(maps.countries, e.country ?? "Unknown");
    bump(maps.devices, e.device);
    bump(maps.browsers, e.browser);
  }
  return {
    pageViews: events.length,
    uniqueVisitors: visitors.size,
    topPages: topN(maps.pages, 8),
    referrers: topN(maps.refs, 8),
    countries: topN(maps.countries, 8),
    devices: topN(maps.devices, 4),
    browsers: topN(maps.browsers, 6),
  };
}

export function rangeStartISO(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}
