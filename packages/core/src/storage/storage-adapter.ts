import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Pluggable "where do the file bytes actually live" step - same adapter
 * shape as NotificationTransport (packages/core/src/notifications/transport.ts).
 * LocalFsAdapter is the only implementation for now; an S3Adapter can be
 * swapped in later (STORAGE_DRIVER=s3) without touching document-service.ts's
 * metadata/attachment logic.
 */
export interface StorageAdapter {
  save(key: string, buffer: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export class LocalFsAdapter implements StorageAdapter {
  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    return join(this.baseDir, key);
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}

/**
 * Resolves the configured adapter from STORAGE_DRIVER. Only "local" is
 * implemented (STORAGE_LOCAL_PATH, default "./.data/documents") - "s3" is
 * documented (see docs/architecture-plan.md) but not built, since there's no
 * bucket/credentials to build against in this environment.
 */
export function createStorageAdapter(): StorageAdapter {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "local") {
    return new LocalFsAdapter(process.env.STORAGE_LOCAL_PATH ?? "./.data/documents");
  }
  throw new Error(`Unsupported STORAGE_DRIVER "${driver}" - only "local" is implemented today.`);
}
