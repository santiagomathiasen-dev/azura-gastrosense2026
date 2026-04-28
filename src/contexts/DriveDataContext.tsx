'use client';

import { createContext, useContext, useCallback, ReactNode } from 'react';
// Types kept for interface compatibility — Drive runtime calls removed
import type { DriveModuleMap, ModuleName } from '@/lib/drive-data-service';

interface DriveDataContextType {
  isReady: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  isDriveConnected: boolean;
  data: DriveModuleMap | null;
  readModule: <T extends ModuleName>(module: T) => Promise<DriveModuleMap[T]>;
  writeModule: <T extends ModuleName>(module: T, data: DriveModuleMap[T]) => Promise<void>;
  addItem: <T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T, collection: K, item: any
  ) => Promise<any>;
  updateItem: <T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T, collection: K, id: string, updates: any
  ) => Promise<any>;
  deleteItem: <T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T, collection: K, id: string
  ) => Promise<void>;
  refresh: () => Promise<void>;
}

const DriveDataContext = createContext<DriveDataContextType | undefined>(undefined);

// Google Drive is disabled — Supabase is the sole data source.
// The provider is kept as a stub so existing component tree doesn't break.
export function DriveDataProvider({ children }: { children: ReactNode }) {
  const noop = useCallback(async () => {}, []);
  const noopRead = useCallback(async <T extends ModuleName>(_module: T): Promise<DriveModuleMap[T]> => {
    throw new Error('Google Drive está desabilitado. Use o Supabase diretamente.');
  }, []);
  const noopWrite = useCallback(async <T extends ModuleName>(_module: T, _data: DriveModuleMap[T]): Promise<void> => {}, []);
  const noopAdd = useCallback(async (_module: any, _collection: any, _item: any): Promise<any> => {}, []);
  const noopUpdate = useCallback(async (_module: any, _collection: any, _id: string, _updates: any): Promise<any> => {}, []);
  const noopDelete = useCallback(async (_module: any, _collection: any, _id: string): Promise<void> => {}, []);

  return (
    <DriveDataContext.Provider value={{
      isReady: true,
      isLoading: false,
      isSaving: false,
      error: null,
      isDriveConnected: false,
      data: null,
      readModule: noopRead,
      writeModule: noopWrite,
      addItem: noopAdd,
      updateItem: noopUpdate,
      deleteItem: noopDelete,
      refresh: noop,
    }}>
      {children}
    </DriveDataContext.Provider>
  );
}

export function useDriveData() {
  const context = useContext(DriveDataContext);
  if (context === undefined) {
    throw new Error('useDriveData must be used within a DriveDataProvider');
  }
  return context;
}
