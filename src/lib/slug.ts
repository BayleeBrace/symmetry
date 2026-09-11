/** "Fade & beard" becomes "fade-beard": letters, digits and single dashes only. */
export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "service"
  );
}
