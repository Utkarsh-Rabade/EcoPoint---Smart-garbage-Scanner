import type { Metadata } from "next";
import "@/styles/shell.css";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your EcoPoints dashboard — see your points and activity.",
};

export default function DashboardPage() {
  return (
    <div className="ep-page">
      {/* Dashboard content — to be built */}
    </div>
  );
}
