const { validateLocales, supportedLocales } = require("../src/i18n");
const errors = validateLocales();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "Translation catalogue validated: " + supportedLocales().join(", "),
  );
}
