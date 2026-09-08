// Loaded by Zen at startup; values are copied into prefs.js
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
user_pref("font.name.serif.x-western", "Roboto Mono");
user_pref("font.name.sans-serif.x-western", "Roboto Mono");
user_pref("font.name.monospace.x-western", "Roboto Mono");
// Ignore site-specified fonts so every page renders in Roboto Mono
// (side effect: icon fonts on some sites render as boxes/letters)
user_pref("browser.display.use_document_fonts", 0);
