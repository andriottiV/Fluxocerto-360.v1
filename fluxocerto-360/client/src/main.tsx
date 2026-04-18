import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function setupAnalytics() {
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT?.trim();
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID?.trim();
  if (!endpoint || !websiteId) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = `${endpoint.replace(/\/+$/, "")}/umami`;
  script.setAttribute("data-website-id", websiteId);
  document.head.appendChild(script);
}

setupAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
