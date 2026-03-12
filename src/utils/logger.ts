import { pino } from "pino";

export const logger = pino({
  level: "info",
  base: { pid: false },
  timestamp: pino.stdTimeFunctions.isoTime,
});
