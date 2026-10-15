import { describe, it, expect } from "vitest";
import { parseUserAgent, isBot, referrerHost, visitorHash, aggregateEvents, pagePathFor } from "@/lib/analytics";
import type { AnalyticsEventDoc } from "@/lib/firestore";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("parseUserAgent / isBot", () => {
  it("detects desktop Chrome", () => expect(parseUserAgent(CHROME)).toEqual({ device: "desktop", browser: "Chrome" }));
  it("detects mobile Safari", () => expect(parseUserAgent(IPHONE)).toEqual({ device: "mobile", browser: "Safari" }));
  it("flags crawlers and empty UAs as bots", () => {
    expect(isBot("Googlebot/2.1")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot(CHROME)).toBe(false);
  });
});

describe("referrerHost", () => {
  it("returns the host, without www", () => expect(referrerHost("https://www.google.com/search?q=x", "me.app")).toBe("google.com"));
  it("treats same-site navigation and missing referrers as direct", () => {
    expect(referrerHost("https://me.app/page", "me.app")).toBeNull();
    expect(referrerHost(null, "me.app")).toBeNull();
    expect(referrerHost("not a url", "me.app")).toBeNull();
  });
});

describe("visitorHash", () => {
  const base = { ip: "1.2.3.4", ua: CHROME, projectId: "p1", date: "2026-10-15", secret: "s" };
  it("is stable within a day and never contains the IP", () => {
    expect(visitorHash(base)).toBe(visitorHash(base));
    expect(visitorHash(base)).not.toContain("1.2.3.4");
  });
  it("rotates daily and differs per project", () => {
    expect(visitorHash({ ...base, date: "2026-10-16" })).not.toBe(visitorHash(base));
    expect(visitorHash({ ...base, projectId: "p2" })).not.toBe(visitorHash(base));
  });
});

describe("aggregateEvents", () => {
  const ev = (o: Partial<AnalyticsEventDoc>): AnalyticsEventDoc => ({
    path: "/", referrer: null, country: "IN", device: "desktop", browser: "Chrome", visitor: "a", createdAt: "2026-10-15T00:00:00Z", ...o,
  });
  it("counts views and unique visitors", () => {
    const r = aggregateEvents([ev({}), ev({}), ev({ visitor: "b", path: "/about.html", referrer: "google.com" })]);
    expect(r.pageViews).toBe(3);
    expect(r.uniqueVisitors).toBe(2);
    expect(r.topPages[0]).toEqual({ key: "/", count: 2 });
    expect(r.referrers.map((x) => x.key)).toContain("google.com");
    expect(r.referrers.map((x) => x.key)).toContain("Direct / none");
  });
  it("handles no data", () => expect(aggregateEvents([]).pageViews).toBe(0));
  it("maps paths", () => {
    expect(pagePathFor("index.html")).toBe("/");
    expect(pagePathFor("about.html")).toBe("/about.html");
  });
});
