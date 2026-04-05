import { useState, useCallback, useRef, useEffect } from 'react';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface CloudFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  thumbnailUrl?: string;
  folderPath: string;
  webContentLink?: string;
}

export interface CloudFolder {
  id: string;
  name: string;
  path: string;
}

export interface GoogleDriveState {
  isConnected: boolean;
  isConnecting: boolean;
  accountEmail: string | null;
  error: string | null;
}

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY ?? '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const TOKEN_KEY = 'merch_miner_gdrive_token';

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useGoogleDrive = () => {
  const [state, setState] = useState<GoogleDriveState>({
    isConnected: false,
    isConnecting: false,
    accountEmail: null,
    error: null,
  });

  const gapiLoadedRef = useRef(false);
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null);

  const isConfigured = Boolean(CLIENT_ID && API_KEY);

  // Load gapi SDK dynamically
  const loadGapiSdk = useCallback((): Promise<void> => {
    if (gapiLoadedRef.current) return Promise.resolve();

    return new Promise((resolve, reject) => {
      // Load gapi
      if (!document.getElementById('gapi-script')) {
        const script = document.createElement('script');
        script.id = 'gapi-script';
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
          gapi.load('client', async () => {
            try {
              await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
              gapiLoadedRef.current = true;
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        };
        script.onerror = reject;
        document.head.appendChild(script);
      } else {
        gapi.load('client', async () => {
          try {
            await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
            gapiLoadedRef.current = true;
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      }

      // Load GIS (Google Identity Services)
      if (!document.getElementById('gis-script')) {
        const gisScript = document.createElement('script');
        gisScript.id = 'gis-script';
        gisScript.src = 'https://accounts.google.com/gsi/client';
        document.head.appendChild(gisScript);
      }
    });
  }, []);

  // Restore token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { access_token: string; email?: string; expires_at?: number };
        // Check if token is expired
        if (parsed.expires_at && parsed.expires_at > Date.now()) {
          loadGapiSdk().then(() => {
            gapi.client.setToken({ access_token: parsed.access_token });
            setState((prev) => ({
              ...prev,
              isConnected: true,
              accountEmail: parsed.email ?? null,
            }));
          }).catch(() => {
            localStorage.removeItem(TOKEN_KEY);
          });
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  }, [loadGapiSdk]);

  // Connect via OAuth2
  const connect = useCallback(async () => {
    if (!isConfigured) return;

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      await loadGapiSdk();

      await new Promise<void>((resolve, reject) => {
        tokenClientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (response) => {
            if (response.error) {
              reject(new Error(response.error));
              return;
            }
            // Persist token
            const tokenData = {
              access_token: response.access_token,
              expires_at: Date.now() + (response.expires_in ?? 3600) * 1000,
            };
            localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
            resolve();
          },
        });
        tokenClientRef.current.requestAccessToken();
      });

      // Fetch user email
      const profileResp = await gapi.client.request({
        path: 'https://www.googleapis.com/oauth2/v2/userinfo',
      });
      const email = profileResp.result?.email ?? null;

      // Update stored token with email
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.email = email;
        localStorage.setItem(TOKEN_KEY, JSON.stringify(parsed));
      }

      setState({
        isConnected: true,
        isConnecting: false,
        accountEmail: email,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: err instanceof Error ? err.message : 'Auth failed',
      }));
    }
  }, [isConfigured, loadGapiSdk]);

  // Disconnect
  const disconnect = useCallback(() => {
    const token = gapi.client.getToken();
    if (token) {
      google.accounts.oauth2.revoke(token.access_token, () => {});
      gapi.client.setToken(null);
    }
    localStorage.removeItem(TOKEN_KEY);
    setState({ isConnected: false, isConnecting: false, accountEmail: null, error: null });
  }, []);

  // List folders in a parent folder
  const listFolders = useCallback(async (parentId = 'root'): Promise<CloudFolder[]> => {
    const resp = await gapi.client.drive.files.list({
      q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      orderBy: 'name',
      pageSize: 100,
    });
    return (resp.result.files ?? []).map((f) => ({
      id: f.id ?? '',
      name: f.name ?? '',
      path: f.name ?? '',
    }));
  }, []);

  // Recursively list images in a folder
  const listImages = useCallback(async (
    folderId: string,
    basePath = '',
  ): Promise<CloudFile[]> => {
    const mimeQuery = IMAGE_MIME_TYPES.map((m) => `mimeType='${m}'`).join(' or ');
    const files: CloudFile[] = [];

    // Get images in this folder
    const imageResp = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and (${mimeQuery}) and trashed=false`,
      fields: 'files(id,name,mimeType,size,thumbnailLink,webContentLink)',
      pageSize: 200,
    });
    for (const f of imageResp.result.files ?? []) {
      const size = Number(f.size ?? 0);
      if (size > MAX_FILE_SIZE) continue;
      files.push({
        id: f.id ?? '',
        name: f.name ?? '',
        mimeType: f.mimeType ?? '',
        size,
        thumbnailUrl: f.thumbnailLink ?? undefined,
        folderPath: basePath || '/',
        webContentLink: f.webContentLink ?? undefined,
      });
    }

    // Recurse into subfolders
    const folderResp = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 50,
    });
    for (const folder of folderResp.result.files ?? []) {
      const subPath = basePath ? `${basePath}/${folder.name}` : (folder.name ?? '');
      const subFiles = await listImages(folder.id ?? '', subPath);
      files.push(...subFiles);
    }

    return files;
  }, []);

  // Download a file as Blob
  const downloadFile = useCallback(async (fileId: string, fileName: string): Promise<File> => {
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${gapi.client.getToken()?.access_token}` } },
    );
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
    const blob = await resp.blob();
    return new File([blob], fileName, { type: blob.type });
  }, []);

  // Upload a file to a specific folder
  const uploadFile = useCallback(async (file: File, folderId: string): Promise<string> => {
    const metadata = {
      name: file.name,
      parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const resp = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${gapi.client.getToken()?.access_token}` },
        body: form,
      },
    );
    if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
    const data = await resp.json();
    return data.id;
  }, []);

  return {
    ...state,
    isConfigured,
    connect,
    disconnect,
    listFolders,
    listImages,
    downloadFile,
    uploadFile,
  };
};

export default useGoogleDrive;
