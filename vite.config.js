import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { singlesDevApi } from "./server/devApi.js";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  for (const name of [
    "SINGLES_GOOGLE_APPS_SCRIPT_URL",
    "SINGLES_SHARED_SECRET",
    "ALLOWED_ORIGIN",
  ]) {
    if (environment[name] !== undefined) process.env[name] = environment[name];
  }
  return { plugins: [react(), singlesDevApi()] };
});
