// The shop API sends money in kobo (1 naira = 100 kobo), like the website.
export function formatNaira(kobo: number): string {
  const [whole, fraction] = (kobo / 100).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return fraction === "00" ? `₦${grouped}` : `₦${grouped}.${fraction}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Orders are stored in UTC. The website shows dates in Lagos time (UTC+1, no
// daylight saving), so a late-night order does not show the wrong day.
export function formatOrderDate(iso: string): string {
  const time = new Date(iso).getTime();

  if (Number.isNaN(time)) {
    return "";
  }

  const lagos = new Date(time + 60 * 60 * 1000);

  return `${lagos.getUTCDate()} ${MONTHS[lagos.getUTCMonth()]} ${lagos.getUTCFullYear()}`;
}