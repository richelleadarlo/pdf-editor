// Theme support removed - site is always in light mode
// Kept as a stub for backwards compatibility if needed

export function useTheme() {
  return {
    theme: "light" as const,
    setTheme: () => {},
    toggleTheme: () => {},
  };
}
