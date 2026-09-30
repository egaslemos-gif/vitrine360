import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

function resolveUrl() {
  return process.env.TURSO_DATABASE_URL || "file:./data/vitrine360-mt.db";
}

async function main() {
  const client = createClient({ 
    url: resolveUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN 
  });
  
  const db = drizzle(client, { schema });
  
  const targetContent = await db.query.contents.findFirst({
    where: eq(schema.contents.title, "Editor smoke text"),
  });
  
  console.log("TARGET CONTENT:");
  console.log(JSON.stringify(targetContent, null, 2));
  
  if (targetContent) {
    const pItems = await db.query.playlistItems.findMany({
      where: eq(schema.playlistItems.contentId, targetContent.id),
    });
    console.log("PLAYLIST ITEMS FOR THIS CONTENT:");
    console.log(JSON.stringify(pItems, null, 2));

    for (const item of pItems) {
      const playlist = await db.query.playlists.findFirst({
        where: eq(schema.playlists.id, item.playlistId)
      });
      console.log("PLAYLIST:");
      console.log(JSON.stringify(playlist, null, 2));

      const schedules = await db.query.schedules.findMany({
        where: eq(schema.schedules.playlistId, item.playlistId)
      });
      console.log("SCHEDULES:");
      console.log(JSON.stringify(schedules, null, 2));
      
      const devices = await db.query.devices.findMany({
        where: eq(schema.devices.currentPlaylistId, item.playlistId)
      });
      console.log("DEVICES WITH THIS PLAYLIST AS DEFAULT:");
      console.log(JSON.stringify(devices, null, 2));
    }
  }

  process.exit(0);
}

main().catch(console.error);
