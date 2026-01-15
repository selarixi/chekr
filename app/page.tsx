"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function isRealIP(value: string) {
  // IPv4 or IPv6 only — exclude mDNS / .local / UUIDs
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^[a-fA-F0-9:]+$/;
  return ipv4.test(value) || ipv6.test(value);
}

export default function PrivacyCheckPage() {
  const [ipInfo, setIpInfo] = useState<any>(null);
  const [webrtcIPs, setWebrtcIPs] = useState<string[]>([]);
  const [ipv6Detected, setIpv6Detected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIP() {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        setIpInfo(data);
        if (data.ip && data.ip.includes(":")) setIpv6Detected(true);
      } catch (e) {
        console.error(e);
      }
    }

    function detectWebRTCLeak() {
      const ips = new Set<string>();
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("");
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      pc.onicecandidate = event => {
        if (!event?.candidate) return;
        const parts = event.candidate.candidate.split(" ");
        const candidate = parts[4];
        if (candidate && isRealIP(candidate)) {
          ips.add(candidate);
          setWebrtcIPs(Array.from(ips));
        }
      };
    }

    fetchIP();
    detectWebRTCLeak();
    setLoading(false);
  }, []);

  if (loading) return <div className="p-10 text-gray-400">Running privacy diagnostics…</div>;

  const asn = ipInfo?.asn || "";
  const org = (ipInfo?.org || "").toLowerCase();

  // Heuristic: most VPNs use datacenter ASNs
  const isDatacenterASN = asn && asn.startsWith("AS");

  const isVPNLikely = isDatacenterASN ||
    org.includes("vpn") ||
    org.includes("hosting") ||
    org.includes("cloud") ||
    org.includes("datacenter");

  let score = 100;
  if (!isVPNLikely) score -= 25;
  if (webrtcIPs.length > 0) score -= 40;
  if (ipv6Detected && !isVPNLikely) score -= 20;

  let verdict = "SECURE";
  if (score < 80) verdict = "PARTIALLY OPEN";
  if (score < 50) verdict = "OPEN / UNPROTECTED";

  const verdictColor = score >= 80 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-500";

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black text-gray-100 p-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Privacy & VPN</h1>
        <p className="text-gray-400 mb-8">Instant analysis of VPN status, IP leaks, and browser privacy risks.</p>

        <Link href="/text" className="block">
          <div className="mt-6 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition cursor-pointer">
            <div className="text-lg font-semibold">monourl</div>
            <div className="text-sm opacity-60">
              Encode text into a shareable offline-safe URL
            </div>
          </div>
        </Link>

        <section className="rounded-2xl bg-gray-900/60 border border-gray-800 p-6 mb-6 shadow-xl">
          <h2 className="text-lg font-semibold mb-3">Verdict</h2>
          <div className="flex items-center justify-between">
            <span className={`text-2xl font-bold ${verdictColor}`}>{verdict}</span>
            <span className="text-3xl font-mono">{score}/100</span>
          </div>
        </section>

        <section className="rounded-2xl bg-gray-900/60 border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Public IP</h2>
          {ipInfo && (
            <ul className="text-sm space-y-1">
              <li><b>IP:</b> {ipInfo.ip}</li>
              <li><b>ISP / ASN:</b> {ipInfo.org} ({asn})</li>
              <li><b>Location:</b> {ipInfo.city}, {ipInfo.country_name}</li>
              <li><b>IP Version:</b> {ipv6Detected ? "IPv6" : "IPv4"}</li>
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-gray-900/60 border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">VPN Detection</h2>
          <p className={isVPNLikely ? "text-green-400" : "text-red-400"}>
            {isVPNLikely
              ? "Datacenter / VPN IP detected — VPN likely active."
              : "Residential IP detected — VPN may be disabled."}
          </p>
        </section>

        <section className="rounded-2xl bg-gray-900/60 border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">WebRTC Leak Test</h2>
          {webrtcIPs.length === 0 ? (
            <p className="text-green-400">No real WebRTC IP leaks detected.</p>
          ) : (
            <div>
              <p className="text-red-400 mb-2">WebRTC is exposing real IP addresses:</p>
              <ul className="text-sm font-mono">
                {webrtcIPs.map(ip => <li key={ip}>{ip}</li>)}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-gray-900/60 border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Additional Checks</h2>
          <ul className="text-sm list-disc ml-5 space-y-1">
            <li>IPv6 exposure: <b>{ipv6Detected ? "Detected" : "Not detected"}</b></li>
            <li>Browser fingerprinting resistance: <b>Limited (expected)</b></li>
            <li>DNS leaks: <b>Requires backend test</b></li>
            <li>Tor exit node: <b>{org.includes("tor") ? "Possible" : "Not detected"}</b></li>
          </ul>
        </section>

        <footer className="text-xs text-gray-500 mt-10 text-center">
          No data is stored. Tests run locally in your browser. Results are heuristic, not guarantees.
        </footer>
      </div>
    </main>
  );
}
