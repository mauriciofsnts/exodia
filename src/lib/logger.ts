import pino from "pino";
import { config } from "@/config/index";

export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true, ignore: "pid,hostname" } }
      : undefined,
});

export type Logger = typeof logger;
