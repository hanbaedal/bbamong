import { createRoot } from "react-dom/client";
import ManagerApp from "./ManagerApp";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
root.render(<ManagerApp />);
