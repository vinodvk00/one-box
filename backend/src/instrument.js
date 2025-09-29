import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://44f8d5245e0b3d35431caafdf08380cb@o4510101705916416.ingest.de.sentry.io/4510101743075408",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});