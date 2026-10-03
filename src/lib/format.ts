// The shop API sends money in kobo (1 naira = 100 kobo), like the website.
export function formatNaira(kobo: number): string {
  const [whole, fraction] = (kobo / 100).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return fraction === "00" ? `₦${grouped}` : `₦${grouped}.${fraction}`;
}