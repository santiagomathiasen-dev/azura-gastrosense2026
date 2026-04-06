import { useState, useCallback } from 'react';
import type { DriveFile } from '@/lib/google-drive';

async function driveAction<T = any>(action: string, extra?: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/drive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro no Google Drive');
  return data as T;
}

export function useGoogleDrive() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrap = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Initialize and get the app folder ID. */
  const initFolder = useCallback(
    () => wrap(() => driveAction<{ folderId: string }>('init')),
    [wrap]
  );

  /** List all files in the app folder. */
  const listFiles = useCallback(
    () => wrap(() => driveAction<{ files: DriveFile[] }>('list')),
    [wrap]
  );

  /** Read a JSON file by ID. */
  const readFile = useCallback(
    <T = unknown>(fileId: string) =>
      wrap(() => driveAction<{ content: T }>('read', { fileId })),
    [wrap]
  );

  /** Save (create or update) a JSON file. */
  const saveFile = useCallback(
    (fileName: string, data: unknown, fileId?: string) =>
      wrap(() => driveAction<{ fileId: string }>('save', { fileName, data, fileId })),
    [wrap]
  );

  /** Delete a file by ID. */
  const deleteFile = useCallback(
    (fileId: string) => wrap(() => driveAction<{ ok: boolean }>('delete', { fileId })),
    [wrap]
  );

  /** Find a file by name. */
  const findFile = useCallback(
    (fileName: string) =>
      wrap(() => driveAction<{ file: DriveFile | null }>('find', { fileName })),
    [wrap]
  );

  return { isLoading, error, initFolder, listFiles, readFile, saveFile, deleteFile, findFile };
}
