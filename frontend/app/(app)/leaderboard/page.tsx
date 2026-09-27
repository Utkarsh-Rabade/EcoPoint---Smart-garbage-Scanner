import type { Metadata } from "next";
import "@/styles/shell.css";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "See where you rank on the EcoPoints leaderboard.",
};

export default function LeaderboardPage() {
  return (
    <div className="ep-page">
      {/* Leaderboard content — to be built */}
    </div>
  );
}
