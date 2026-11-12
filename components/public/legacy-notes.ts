export type LegacyNote = { id: string; text: string; createdAt: string };

export const legacyExportUrl = "https://tonetowngoeswest.github.io/vibe-log/export-comments.html";

export function parseLegacyNotes(saved: string | null): LegacyNote[] {
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed) || !parsed.every(item => item && typeof item === "object" && typeof item.id === "string" && typeof item.text === "string" && typeof item.createdAt === "string" && !Number.isNaN(Date.parse(item.createdAt)))) throw new Error("These saved notes could not be read. Open the browser and address where you originally wrote them.");
  return parsed.map(item => ({ id: item.id, text: item.text, createdAt: item.createdAt }));
}
