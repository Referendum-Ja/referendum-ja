import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";

export default defineConfig({
  site: "https://noalacord.com",
  output: "static",
  integrations: [svelte()],
  i18n: {
    defaultLocale: "ca",
    locales: ["ca", "fr", "es"],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    server: { headers: { "Cache-Control": "no-store" } },
  },
});
