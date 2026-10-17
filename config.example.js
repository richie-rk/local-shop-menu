/*
 * ============================================================
 *  SHOP CONFIGURATION: example / blank template
 * ============================================================
 *  Copy this file over config.js and fill in your shop's details.
 *  config.js is the ONLY file a shop needs to change.
 *
 *  Rules of thumb:
 *   - Any optional text left as "" is hidden on the site.
 *   - Keep the quotes and commas exactly as shown.
 *   - After editing, open index.html (or your deployed site) and reload.
 */
window.SHOP_CONFIG = {
  // ---- Basics ------------------------------------------------
  shopName: "Your Shop Name",                    // required
  tagline: "Fresh, local, delivered",            // optional one-liner under the name
  logoUrl: "",                                   // optional square image URL (https://...). Empty = initials badge
  businessType: "Chicken shop · Retail",         // optional small label under the name

  // ---- Contact -----------------------------------------------
  phone: "",                                     // optional, e.g. "098765 43210". Shows a Call button
  whatsappNumber: "91XXXXXXXXXX",                // REQUIRED for ordering: country code + number, digits only
  googleReviewUrl: "",                           // optional "Rate us on Google" link (see README)

  highlights: ["Fresh daily", "Home delivery"],  // optional chips at the top; [] to hide

  // ---- Delivery ----------------------------------------------
  delivery: {
    enabled: true,                               // false = pickup only (hides the pickup/delivery choice)
    free: false,                                 // true = "FREE home delivery" banner + FREE in cart
    charge: 30,                                  // delivery fee in your currency (used when free = false)
    freeAbove: 500,                              // waive the fee above this total (0 = never)
    minOrder: 0,                                 // minimum order total for delivery (0 = no minimum)
    note: "Within 3 km"                          // optional short note shown with the delivery offer
  },

  // ---- Opening hours -----------------------------------------
  // days: "Mon-Sun", "Mon-Sat", "Sun", "Mon, Wed, Fri", "daily"
  // slots: one or more "HH:MM-HH:MM" ranges in 24-hour time (overnight like "18:00-02:00" works)
  // Later entries override earlier ones for the same day.
  // Or simply: openingHours: "9 am – 9 pm, all days"  (shown as text, no open/closed badge)
  openingHours: {
    timezone: "Asia/Kolkata",
    schedule: [
      { days: "Mon-Sat", slots: ["08:00-13:00", "17:00-21:00"] },
      { days: "Sun", slots: ["08:00-13:00"] }
      // { days: "Tue", closed: true }
    ],
    note: ""                                     // optional, e.g. "Closed on public holidays"
  },

  // ---- Location ----------------------------------------------
  location: {
    addressLine: "Shop No. 1, Example Market",
    area: "Sector 1, Vashi",
    city: "Navi Mumbai",
    state: "Maharashtra",
    pincode: "400703",
    landmark: "",                                // optional, e.g. "Near XYZ Bus Stop"
    latitude: 19.0771,                           // right-click your shop in Google Maps → click the numbers to copy
    longitude: 72.9986,
    googleMapsUrl: "",                           // optional: your shop's Google Maps share link
    showMap: true                                // show an embedded map (needs latitude + longitude)
  },

  // ---- Menu data ---------------------------------------------
  currencySymbol: "₹",
  locale: "en-IN",
  // Google Sheet published as CSV (File → Share → Publish to web → choose sheet → CSV).
  // Leave "" to show the demo menu from data/sample-menu.csv.
  sheetCsvUrl: "",
  showOutOfStock: "greyed",                      // "greyed" or "hide"

  // ---- WhatsApp order message --------------------------------
  orderMessageTemplate: "Hi {shopName}! I'd like to place an order:",

  // ---- Look & feel -------------------------------------------
  theme: {
    primary: "#b3261e",
    primaryDark: "#8c1d17",
    accent: "#f4b400",
    onAccent: "#1f1300",
    background: "#fff8f2",
    surface: "#ffffff",
    text: "#1f1a17",
    fontFamily: "",
    googleFontUrl: ""
  },

  // ---- Footer ------------------------------------------------
  footerCredit: { enabled: true, text: "Built by Richy", url: "https://richie-rk.github.io" }
};
