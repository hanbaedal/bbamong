import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import UserApp from "./UserApp";
import AdminApp from "./AdminApp";
import ManagerApp from "./ManagerApp";
import PublicApp from "./PublicApp";
import { isPublicSitePath } from "./lib/shopRoutes";
import "./index.css";

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("native-app");
}

const root = createRoot(document.getElementById("root")!);

const path = window.location.pathname;

if (path.startsWith("/manager")) {
  root.render(<ManagerApp />);
} else if (path.startsWith("/admin")) {
  root.render(<AdminApp />);
} else if (isPublicSitePath(path)) {
  root.render(<PublicApp />);
} else {
  root.render(<UserApp />);
}
