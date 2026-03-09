import { exec } from "child_process";
import { promisify } from "util";
import pino from "pino";

const execAsync = promisify(exec);
const logger = pino({
  name: "CalendarService",
});

export interface CalendarEvent {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

/**
 * Service to manage Google Calendar events using gogcli.
 */
export class CalendarService {
  private user: string;

  constructor(
    user: string = process.env.GMAIL_USER || "sandaluci88@gmail.com",
  ) {
    this.user = user;
    logger.info(`CalendarService initialized for ${this.user}`);
  }

  /**
   * Fetches the agenda for today.
   */
  async getTodayAgenda(): Promise<CalendarEvent[]> {
    try {
      logger.info("Fetching today's agenda...");
      const { stdout } = await execAsync(
        `gog calendar list --account ${this.user} --today --json`,
      );
      const events = JSON.parse(stdout);

      if (!Array.isArray(events)) return [];

      return events.map((event: any) => ({
        summary: event.Summary || event.summary,
        start:
          event.Start?.DateTime ||
          event.start?.dateTime ||
          event.Start?.Date ||
          event.start?.date,
        end:
          event.End?.DateTime ||
          event.end?.dateTime ||
          event.End?.Date ||
          event.end?.date,
        description: event.Description || event.description,
        location: event.Location || event.location,
      }));
    } catch (error) {
      logger.error({ err: error }, "Error fetching today's agenda");
      return [];
    }
  }

  /**
   * Creates a new event on the calendar.
   */
  async addEvent(
    summary: string,
    startTime: string,
    endTime: string,
    description?: string,
  ): Promise<boolean> {
    try {
      logger.info(`Adding event: ${summary} (${startTime} - ${endTime})`);
      let cmd = `gog calendar add --account ${this.user} --summary "${summary}" --from "${startTime}" --to "${endTime}"`;
      if (description) {
        cmd += ` --description "${description}"`;
      }

      await execAsync(cmd);
      return true;
    } catch (error) {
      logger.error({ err: error }, "Error adding event");
      return false;
    }
  }
}
