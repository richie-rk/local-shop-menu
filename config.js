/*
 * ============================================================
 *  SHOP CONFIGURATION: the ONLY file you need to edit.
 * ============================================================
 *  Every shop-specific detail lives here. See config.example.js
 *  for a blank, fully commented copy, and README.md for help.
 *
 *  Tip: leave any optional text field as "" to hide it on the site.
 */
window.SHOP_CONFIG = {
  // ---- Basics ------------------------------------------------
  shopName: "A1 Bharat Chicken Shop",
  tagline: "Fresh chicken & eggs, cut to order every day",
  logoUrl: "",                       // square image URL; empty = initials badge
  businessType: "Chicken shop · Wholesale & retail",

  // ---- Contact -----------------------------------------------
  phone: "080979 84544",             // shown as-is; used for the Call button
  whatsappNumber: "918097984544",    // country code + number, digits only (no +, spaces or leading 0)
  googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJO9ul3c3B5zsRXFWxuG_eC_E",

  // Short selling points shown as chips at the top (free delivery has its own banner).
  highlights: ["Fresh cut daily", "Wholesale rates", "Eggs by dozen & tray"],

  // ---- Delivery ----------------------------------------------
  delivery: {
    enabled: true,                   // false = pickup only
    free: true,                      // shows "FREE home delivery" banner and FREE in the cart
    charge: 0,                       // delivery fee when free = false
    freeAbove: 0,                    // when free = false: waive the fee above this order total (0 = never)
    minOrder: 0,                     // minimum order total for delivery (0 = none)
    note: "Vashi & nearby sectors"   // short line shown next to the delivery offer
  },

  // ---- Opening hours -----------------------------------------
  // Each entry: days ("Mon-Sun", "Mon-Sat", "Sun", "Mon, Wed") + time slots ("HH:MM-HH:MM", 24h).
  // Later entries override earlier ones, e.g. add { days: "Tue", closed: true } for a weekly holiday.
  // You can also set openingHours to a plain string such as "9 am to 9 pm, all days".
  openingHours: {
    timezone: "Asia/Kolkata",
    schedule: [
      { days: "Mon-Sun", slots: ["09:30-14:30", "18:00-22:00"] }
    ],
    note: ""
  },

  // ---- Location ----------------------------------------------
  location: {
    addressLine: "Shop 1, Mini Market 2",
    area: "Juhu Nagar, Sector 9, Vashi",
    city: "Navi Mumbai",
    state: "Maharashtra",
    pincode: "400703",
    landmark: "",                    // optional, e.g. "Opposite XYZ School"
    latitude: 19.0792532,
    longitude: 72.997684,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=A1%20Bharat%20Chicken%20Shop&query_place_id=ChIJO9ul3c3B5zsRXFWxuG_eC_E",
    showMap: true                    // embedded map built from latitude/longitude
  },

  // ---- Menu data ---------------------------------------------
  currencySymbol: "₹",
  locale: "en-IN",                   // number formatting (₹1,250.50)
  // Google Sheet → File → Share → Publish to web → (your sheet) → CSV. Paste the link here.
  // Leave empty to use the demo menu in data/sample-menu.csv.
  sheetCsvUrl: "",
  showOutOfStock: "greyed",          // "greyed" = show with "Out of stock" label, "hide" = don't show

  // ---- WhatsApp order message --------------------------------
  // First line of the order message. {shopName} is replaced automatically.
  orderMessageTemplate: "Hi {shopName}! I'd like to place an order:",

  // ---- Look & feel -------------------------------------------
  theme: {
    primary: "#b3261e",              // header band, buttons (keep it dark enough for white text)
    primaryDark: "#8c1d17",          // hover state
    accent: "#f4b400",               // delivery banner, focus ring
    onAccent: "#1f1300",             // text on the accent colour
    background: "#fff8f2",
    surface: "#ffffff",
    text: "#1f1a17",
    fontFamily: "",                  // e.g. "'Poppins', system-ui, sans-serif"
    googleFontUrl: ""                // e.g. "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap"
  },

  // ---- Footer ------------------------------------------------
  footerCredit: { enabled: true, text: "Built by Richy", url: "https://richie-rk.github.io" }
};
