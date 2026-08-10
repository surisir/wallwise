import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Wallwise | Visualize paint", description: "AI-powered room recoloring" };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
