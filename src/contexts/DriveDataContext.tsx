'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { driveDataService, DriveModuleMap, ModuleName } from '@/lib/drive-data-service';
import { toast } from 'sonner';

interface DriveDataContextType {
  /** Whether Drive is connected and data is loaded */
  isReady: boolean;
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether user has Google Drive connected */
  isDriveConnected: boolean;
  /** All data loaded from Drive */
  data: DriveModuleMap | null;
  /** Read a module's data */
  readModule: <T extends ModuleName>(module: T) => Promise<DriveModuleMap[T]>;
  /** Write a module's data */
  writeModule: <T extends ModuleName>(module: T, data: DriveModuleMap[T]) => Promise<void>;
  /** Add item to a collection */
  addItem: <T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T, collection: K, item: any
  ) => Promise<any>;
  /** Update item in a collection */
  updateItem: <T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T, collection: K, id: string, updates: any
  ) => Promise<any>;
  /** Delete item from a collection */
  deleteItem: <T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T, collection: K, id: string
  ) => Promise<void>;
  /** Force reload all data from Drive */
  refresh: () => Promise<void>;
}

const DriveDataContext = createContext<DriveDataContextType | undefined>(undefined);

export function DriveDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [data, setData] = useState<DriveModuleMap | null>(null);

  // Initialize Drive on login
  useEffect(() => {
    if (!user?.id) {
      setIsReady(false);
      setIsDriveConnected(false);
      setData(null);
      return;
    }

    let cancelled = false;

    const initDrive = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await driveDataService.init();
        if (cancelled) return;

        setIsDriveConnected(true);

        // Load all modules
        const allData = await driveDataService.loadAll();
        if (cancelled) return;

        setData(allData);
        setIsReady(true);
      } catch (err: any) {
        if (cancelled) return;
        console.warn('DriveDataProvider: Drive not available, falling back to Supabase', err);
        setIsDriveConnected(false);
        setError(err.message);
        // Still mark as ready so the app works with Supabase fallback
        setIsReady(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initDrive();
    return () => { cancelled = true; };
  }, [user?.id]);

  const readModule = useCallback(async <T extends ModuleName>(module: T): Promise<DriveModuleMap[T]> => {
    return driveDataService.readModule(module);
  }, []);

  const writeModule = useCallback(async <T extends ModuleName>(module: T, moduleData: DriveModuleMap[T]): Promise<void> => {
    setIsSaving(true);
    try {
      await driveDataService.writeModule(module, moduleData);
      // Update local state
      setData(prev => prev ? { ...prev, [module]: moduleData } : null);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const addItem = useCallback(async <T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T, collection: K, item: any
  ): Promise<any> => {
    setIsSaving(true);
    try {
      const result = await driveDataService.addItem(module, collection, item);
      // Refresh module data in state
      const updated = await driveDataService.readModule(module);
      setData(prev => prev ? { ...prev, [module]: updated } : null);
      return result;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateItem = useCallback(async <T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T, collection: K, id: string, updates: any
  ): Promise<any> => {
    setIsSaving(true);
    try {
      const result = await driveDataService.updateItem(module, collection, id, updates);
      const updated = await driveDataService.readModule(module);
      setData(prev => prev ? { ...prev, [module]: updated } : null);
      return result;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteItem = useCallback(async <T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T, collection: K, id: string
  ): Promise<void> => {
    setIsSaving(true);
    try {
      await driveDataService.deleteItem(module, collection, id);
      const updated = await driveDataService.readModule(module);
      setData(prev => prev ? { ...prev, [module]: updated } : null);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      driveDataService.clearCache();
      const allData = await driveDataService.loadAll();
      setData(allData);
    } catch (err: any) {
      setError(err.message);
      toast.error('Erro ao sincronizar com Google Drive');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <DriveDataContext.Provider value={{
      isReady,
      isLoading,
      isSaving,
      error,
      isDriveConnected,
      data,
      readModule,
      writeModule,
      addItem,
      updateItem,
      deleteItem,
      refresh,
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
