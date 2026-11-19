import crypto from "crypto";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY = "hashwatch:targets";

export default async function handler(req, res) {
  if (!process.env.PROXY_SECRET || req.headers["x-api-key"] !== process.env.PROXY_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const raw = (await redis.hgetall(KEY)) || {};
      const targets = Object.values(raw).map((item) =>
        typeof item === "string" ? JSON.parse(item) : item
      );
      targets.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return res.status(200).json(targets);
    }

    if (req.method === "POST") {
      const {
        name,
        url,
        selector = "body",
        keywords = [],
        topic = "general",
        use_proxy = true,
      } = req.body || {};

      if (!name?.trim() || !url?.trim()) {
        return res.status(400).json({ error: "Name and URL are required." });
      }

      const id = crypto.randomUUID();
      const target = {
        id,
        name: name.trim(),
        url: url.trim(),
        selector: selector.trim() || "body",
        keywords: Array.isArray(keywords)
          ? keywords.map((k) => k.trim()).filter(Boolean)
          : String(keywords).split(",").map((k) => k.trim()).filter(Boolean),
        topic: topic.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-") || "general",
        use_proxy: Boolean(use_proxy),
        createdAt: new Date().toISOString(),
      };

      await redis.hset(KEY, { [id]: JSON.stringify(target) });
      return res.status(200).json(target);
    }

    if (req.method === "DELETE") {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "Target ID required." });

      await redis.hdel(KEY, id);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error("Targets API error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}