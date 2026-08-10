import type { Config } from "tailwindcss";
export default { content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"], theme: { extend: { colors: { ink: "#18211d", sage: "#587064", paper: "#f5f5f1" } } }, plugins: [] } satisfies Config;
