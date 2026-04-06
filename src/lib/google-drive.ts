const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const APP_FOLDER = 'AzuraGastroSense';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

async function driveRequest(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Drive API ${res.status}: ${body}`);
  }
  return res;
}

/** Find or create the app root folder in the user's Drive. */
export async function getOrCreateAppFolder(accessToken: string): Promise<string> {
  // Search for existing folder
  const q = `name='${APP_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await driveRequest(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`,
    accessToken
  );
  const data = await res.json();

  if (data.files?.length > 0) {
    return data.files[0].id;
  }

  // Create the folder
  const createRes = await driveRequest(`${DRIVE_API}/files`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: APP_FOLDER,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const folder = await createRes.json();
  return folder.id;
}

/** List JSON data files in the app folder. */
export async function listFiles(
  accessToken: string,
  folderId: string
): Promise<DriveFile[]> {
  const q = `'${folderId}' in parents and trashed=false`;
  const res = await driveRequest(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime desc&spaces=drive`,
    accessToken
  );
  const data = await res.json();
  return data.files ?? [];
}

/** Read a JSON file from Drive. */
export async function readJsonFile<T = unknown>(
  accessToken: string,
  fileId: string
): Promise<T> {
  const res = await driveRequest(
    `${DRIVE_API}/files/${fileId}?alt=media`,
    accessToken
  );
  return res.json() as Promise<T>;
}

/** Create or update a JSON file in the app folder. */
export async function saveJsonFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  data: unknown,
  existingFileId?: string
): Promise<string> {
  const body = JSON.stringify(data, null, 2);
  const blob = new Blob([body], { type: 'application/json' });

  if (existingFileId) {
    // Update existing file content
    await driveRequest(
      `${UPLOAD_API}/files/${existingFileId}?uploadType=media`,
      accessToken,
      { method: 'PATCH', body: blob, headers: { 'Content-Type': 'application/json' } }
    );
    return existingFileId;
  }

  // Create new file with multipart upload (metadata + content)
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
  });

  const boundary = 'azura_boundary_' + Date.now();
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n` +
    `--${boundary}--`;

  const res = await driveRequest(
    `${UPLOAD_API}/files?uploadType=multipart&fields=id`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipart,
    }
  );
  const file = await res.json();
  return file.id;
}

/** Delete a file from Drive. */
export async function deleteFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  await driveRequest(`${DRIVE_API}/files/${fileId}`, accessToken, {
    method: 'DELETE',
  });
}

/** Find a file by name in the app folder. */
export async function findFileByName(
  accessToken: string,
  folderId: string,
  fileName: string
): Promise<DriveFile | null> {
  const q = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
  const res = await driveRequest(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,modifiedTime)&spaces=drive`,
    accessToken
  );
  const data = await res.json();
  return data.files?.[0] ?? null;
}
