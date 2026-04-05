import { useState, useCallback, useEffect, useRef } from 'react';
import { PublicClientApplication, type AccountInfo } from '@azure/msal-browser';
import type { CloudFile, CloudFolder } from './useGoogleDrive';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const CLIENT_ID = import.meta.env.VITE_ONEDRIVE_CLIENT_ID ?? '';
const SCOPES = ['Files.ReadWrite', 'User.Read'];
const GRAPH_URL = 'https://graph.microsoft.com/v1.0';
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface OneDriveState {
  isConnected: boolean;
  isConnecting: boolean;
  accountEmail: string | null;
  error: string | null;
}

interface GraphDriveItem {
  id: string;
  name: string;
  size?: number;
  file?: { mimeType: string };
  folder?: { childCount: number };
  thumbnails?: Array<{ small?: { url: string } }>;
  '@microsoft.graph.downloadUrl'?: string;
  parentReference?: { path?: string };
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useOneDrive = () => {
  const [state, setState] = useState<OneDriveState>({
    isConnected: false,
    isConnecting: false,
    accountEmail: null,
    error: null,
  });

  const msalRef = useRef<PublicClientApplication | null>(null);
  const accountRef = useRef<AccountInfo | null>(null);

  const isConfigured = Boolean(CLIENT_ID);

  // Initialize MSAL on mount
  useEffect(() => {
    if (!isConfigured) return;

    const msal = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'localStorage' },
    });

    msal.initialize().then(() => {
      msalRef.current = msal;

      // Check if already logged in (MSAL persists in localStorage)
      const accounts = msal.getAllAccounts();
      if (accounts.length > 0) {
        accountRef.current = accounts[0];
        setState({
          isConnected: true,
          isConnecting: false,
          accountEmail: accounts[0].username ?? null,
          error: null,
        });
      }
    }).catch(() => {
      // MSAL init failed silently
    });
  }, [isConfigured]);

  // Get access token (silent refresh or popup)
  const getToken = useCallback(async (): Promise<string> => {
    const msal = msalRef.current;
    const account = accountRef.current;
    if (!msal || !account) throw new Error('Not connected');

    try {
      const resp = await msal.acquireTokenSilent({ scopes: SCOPES, account });
      return resp.accessToken;
    } catch {
      const resp = await msal.acquireTokenPopup({ scopes: SCOPES });
      return resp.accessToken;
    }
  }, []);

  // Graph API fetch helper
  const graphFetch = useCallback(async (path: string, init?: RequestInit) => {
    const token = await getToken();
    const resp = await fetch(`${GRAPH_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
    if (!resp.ok) throw new Error(`Graph API error: ${resp.status}`);
    return resp;
  }, [getToken]);

  // Connect
  const connect = useCallback(async () => {
    if (!isConfigured || !msalRef.current) return;

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const resp = await msalRef.current.loginPopup({ scopes: SCOPES });
      accountRef.current = resp.account;
      setState({
        isConnected: true,
        isConnecting: false,
        accountEmail: resp.account?.username ?? null,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: err instanceof Error ? err.message : 'Auth failed',
      }));
    }
  }, [isConfigured]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (msalRef.current && accountRef.current) {
      try {
        await msalRef.current.logoutPopup({ account: accountRef.current });
      } catch {
        // Logout popup may be blocked, clear local state anyway
      }
    }
    accountRef.current = null;
    setState({ isConnected: false, isConnecting: false, accountEmail: null, error: null });
  }, []);

  // List folders in a parent
  const listFolders = useCallback(async (parentId = 'root'): Promise<CloudFolder[]> => {
    const path = parentId === 'root'
      ? '/me/drive/root/children?$filter=folder ne null&$select=id,name&$orderby=name'
      : `/me/drive/items/${parentId}/children?$filter=folder ne null&$select=id,name&$orderby=name`;

    const resp = await graphFetch(path);
    const data = await resp.json();
    return (data.value ?? []).map((item: GraphDriveItem) => ({
      id: item.id,
      name: item.name,
      path: item.name,
    }));
  }, [graphFetch]);

  // Recursively list images
  const listImages = useCallback(async (
    folderId: string,
    basePath = '',
  ): Promise<CloudFile[]> => {
    const path = folderId === 'root'
      ? '/me/drive/root/children?$select=id,name,size,file,folder,parentReference&$top=200'
      : `/me/drive/items/${folderId}/children?$select=id,name,size,file,folder,parentReference&$top=200`;

    const resp = await graphFetch(path);
    const data = await resp.json();
    const files: CloudFile[] = [];

    for (const item of (data.value ?? []) as GraphDriveItem[]) {
      // If it's a file with an image extension
      if (item.file) {
        const ext = item.name.split('.').pop()?.toLowerCase() ?? '';
        if (!IMAGE_EXTENSIONS.includes(ext)) continue;
        if ((item.size ?? 0) > MAX_FILE_SIZE) continue;

        files.push({
          id: item.id,
          name: item.name,
          mimeType: item.file.mimeType ?? `image/${ext}`,
          size: item.size ?? 0,
          folderPath: basePath || '/',
        });
      }

      // Recurse into subfolders
      if (item.folder) {
        const subPath = basePath ? `${basePath}/${item.name}` : item.name;
        const subFiles = await listImages(item.id, subPath);
        files.push(...subFiles);
      }
    }

    return files;
  }, [graphFetch]);

  // Download file
  const downloadFile = useCallback(async (fileId: string, fileName: string): Promise<File> => {
    const resp = await graphFetch(`/me/drive/items/${fileId}/content`);
    const blob = await resp.blob();
    return new File([blob], fileName, { type: blob.type });
  }, [graphFetch]);

  // Upload file to a specific folder
  const uploadFile = useCallback(async (file: File, folderId: string): Promise<string> => {
    const path = folderId === 'root'
      ? `/me/drive/root:/${file.name}:/content`
      : `/me/drive/items/${folderId}:/${file.name}:/content`;

    const resp = await graphFetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    const data = await resp.json();
    return data.id;
  }, [graphFetch]);

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

export default useOneDrive;
