import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home",
  description: "Welcome to EcoPoints — earn rewards for recycling.",
};

export default function HomePage() {
  return (
    <main>
      <h1>EcoPoints</h1>
      <p>Welcome. Please log in or sign up to get started.</p>
      <nav>
        <a href="/login">Log in</a>
        <a href="/signup">Sign up</a>
      </nav>
    </main>
  );
}
