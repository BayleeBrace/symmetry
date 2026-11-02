export const shopContact = {
  phone: process.env.SHOP_PHONE?.trim() || "",
  // The shop inbox is confirmed in the brand handover (2 November 2026).
  // The phone number is not: set SHOP_PHONE only once it is confirmed.
  email: process.env.SHOP_EMAIL?.trim() || "info@symmetrywales.com",
  mapUrl: "https://maps.google.com/?q=4+Brewery+Terrace+Saundersfoot+SA69+9HG",
};
