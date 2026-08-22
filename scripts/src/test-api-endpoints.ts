import path from "path";
import fs from "fs";
import http from "http";

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      try {
        process.loadEnvFile(file);
      } catch {}
      break;
    }
  }
}
loadEnv();

import app from "../../artifacts/api-server/src/app";

async function runApiTests() {
  console.log("=================================================");
  console.log("          API SERVER LIVE ENDPOINTS TEST         ");
  console.log("=================================================");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5002, resolve));
  console.log("Test API Server listening on http://localhost:5002");

  async function fetchEndpoint(pathStr: string) {
    console.log(`\n-------------------------------------------------`);
    console.log(`FETCHING: http://localhost:5002${pathStr}`);
    console.log(`-------------------------------------------------`);
    const res = await fetch(`http://localhost:5002${pathStr}`);
    const json = await res.json();
    console.log(`STATUS: ${res.status} ${res.statusText}`);
    console.log("RAW JSON RESPONSE:");
    console.log(JSON.stringify(json, null, 2));
  }

  try {
    await fetchEndpoint("/api/internships");
    await fetchEndpoint("/api/recommendations?student_id=00000000-0000-0000-0000-000000000001");
    await fetchEndpoint("/api/students/me");
  } catch (err: any) {
    console.error("API Fetch Error:", err);
  } finally {
    server.close();
  }
}

runApiTests();
