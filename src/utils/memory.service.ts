import fs from "fs/promises";
import path from "path";

export interface MemoryMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export class MemoryService {
  private memoryDir: string;
  private archiveDir: string;
  private maxAgeMs: number; // 3 days

  constructor() {
    this.memoryDir = path.join(process.cwd(), "data", "memory");
    this.archiveDir = path.join(this.memoryDir, "archive");
    this.maxAgeMs = 3 * 24 * 60 * 60 * 1000;
  }

  async initialize() {
    try {
      await fs.mkdir(this.memoryDir, { recursive: true });
      await fs.mkdir(this.archiveDir, { recursive: true });
    } catch (error) {
      console.error("Failed to initialize memory directories", { error });
    }
  }

  private getFilePath(chatId: string | number): string {
    return path.join(this.memoryDir, `${chatId}.json`);
  }

  private getArchiveFilePath(chatId: string | number): string {
    return path.join(this.archiveDir, `${chatId}_archive.json`);
  }

  async getHistory(chatId: string | number): Promise<MemoryMessage[]> {
    const filePath = this.getFilePath(chatId);
    try {
      const data = await fs.readFile(filePath, "utf-8");
      const allMessages: MemoryMessage[] = JSON.parse(data);

      const now = Date.now();
      const activeMessages = allMessages.filter(
        (msg) => now - msg.timestamp <= this.maxAgeMs,
      );

      const archivedMessages = allMessages.filter(
        (msg) => now - msg.timestamp > this.maxAgeMs,
      );

      // If we filtered out old messages, archive them and update the current file
      if (archivedMessages.length > 0) {
        await this.archiveMessages(chatId, archivedMessages);
        await fs.writeFile(
          filePath,
          JSON.stringify(activeMessages, null, 2),
          "utf-8",
        );
      }

      return activeMessages;
    } catch (error: any) {
      if (error && (error as any).code !== "ENOENT") {
        console.error(`Failed to read history for chat ${chatId}`, { error });
      }
      return [];
    }
  }

  async saveMessage(
    chatId: string | number,
    role: "user" | "assistant",
    content: string,
  ) {
    const messages = await this.getHistory(chatId);
    messages.push({
      role,
      content,
      timestamp: Date.now(),
    });

    try {
      await fs.writeFile(
        this.getFilePath(chatId),
        JSON.stringify(messages, null, 2),
        "utf-8",
      );
    } catch (error) {
      console.error(`Failed to save message for chat ${chatId}`, { error });
    }
  }

  private async archiveMessages(
    chatId: string | number,
    newArchivedMessages: MemoryMessage[],
  ) {
    if (newArchivedMessages.length === 0) return;

    const archivePath = this.getArchiveFilePath(chatId);
    let existingArchive: MemoryMessage[] = [];
    try {
      const data = await fs.readFile(archivePath, "utf-8");
      existingArchive = JSON.parse(data);
    } catch (error: any) {
      // It's okay if archive doesn't exist yet
    }

    const combinedArchive = [...existingArchive, ...newArchivedMessages];

    try {
      await fs.writeFile(
        archivePath,
        JSON.stringify(combinedArchive, null, 2),
        "utf-8",
      );
    } catch (error) {
      console.error(`Failed to write to archive for chat ${chatId}`, { error });
    }
  }
}

export const memoryService = new MemoryService();
