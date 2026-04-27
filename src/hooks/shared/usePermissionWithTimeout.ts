/**
 * usePermissionWithTimeout.ts
 * Hook que adiciona timeout e fallback para verificações de permissão
 * Evita que o frontend fique travado esperando por APIs lentas
 */

import { useState, useEffect } from 'react';

interface PermissionCheckResult {
  isLoading: boolean;
  hasTimedOut: boolean;
  error: string | null;
  data: any;
  status: 'idle' | 'loading' | 'success' | 'timeout' | 'error';
}

interface UsePermissionWithTimeoutProps {
  checkFn: () => Promise<any>;
  timeout?: number; // Default: 8000ms
  onTimeout?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook que executa uma função de verificação com timeout
 * Se demorar mais que o timeout, retorna fallback em vez de ficar loading
 */
export function usePermissionWithTimeout({
  checkFn,
  timeout = 8000,
  onTimeout,
  onError,
}: UsePermissionWithTimeoutProps): PermissionCheckResult {
  const [state, setState] = useState<PermissionCheckResult>({
    isLoading: true,
    hasTimedOut: false,
    error: null,
    data: null,
    status: 'loading',
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const executeCheck = async () => {
      try {
        // Inicia timeout
        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.warn('⚠️ Permission check timed out after', timeout, 'ms');
            setState({
              isLoading: false,
              hasTimedOut: true,
              error: 'Verificação de permissões demorou muito',
              data: null,
              status: 'timeout',
            });
            onTimeout?.();
          }
        }, timeout);

        // Executa a função
        const result = await checkFn();

        // Se chegou aqui antes do timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (isMounted) {
          setState({
            isLoading: false,
            hasTimedOut: false,
            error: null,
            data: result,
            status: 'success',
          });
        }
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('❌ Permission check error:', errorMessage);

        if (isMounted) {
          setState({
            isLoading: false,
            hasTimedOut: false,
            error: errorMessage,
            data: null,
            status: 'error',
          });
          onError?.(error instanceof Error ? error : new Error(errorMessage));
        }
      }
    };

    executeCheck();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [checkFn, timeout, onTimeout, onError]);

  return state;
}

/**
 * Hook helper para múltiplas verificações paralelas com timeout
 * Retorna assim que qualquer uma falha ou após timeout
 */
export function useMultiplePermissionsWithTimeout(
  checks: Array<{
    name: string;
    checkFn: () => Promise<any>;
    timeout?: number;
  }>
): Record<
  string,
  PermissionCheckResult
> & { allReady: boolean; hasAnyError: boolean; hasAnyTimeout: boolean } {
  const [results, setResults] = useState<Record<string, PermissionCheckResult>>(
    checks.reduce((acc, check) => {
      acc[check.name] = {
        isLoading: true,
        hasTimedOut: false,
        error: null,
        data: null,
        status: 'loading',
      };
      return acc;
    }, {} as Record<string, PermissionCheckResult>)
  );

  useEffect(() => {
    let isMounted = true;
    const timeoutIds: Record<string, NodeJS.Timeout> = {};

    const executeChecks = async () => {
      const checkPromises = checks.map(async (check) => {
        try {
          // Timeout individual por check
          const timeout = check.timeout || 8000;

          const timeoutPromise = new Promise((_, reject) => {
            const id = setTimeout(() => {
              reject(new Error('_TIMEOUT_'));
            }, timeout);
            timeoutIds[check.name] = id;
          });

          const result = await Promise.race([checkPromise(check.checkFn), timeoutPromise]);

          if (isMounted) {
            setResults((prev) => ({
              ...prev,
              [check.name]: {
                isLoading: false,
                hasTimedOut: false,
                error: null,
                data: result,
                status: 'success',
              },
            }));
          }
        } catch (error) {
          const isTimeout = error instanceof Error && error.message === '_TIMEOUT_';
          const errorMessage = isTimeout
            ? 'Verificação demorou muito'
            : error instanceof Error
              ? error.message
              : 'Erro desconhecido';

          if (isMounted) {
            setResults((prev) => ({
              ...prev,
              [check.name]: {
                isLoading: false,
                hasTimedOut: isTimeout,
                error: errorMessage,
                data: null,
                status: isTimeout ? 'timeout' : 'error',
              },
            }));
          }
        }
      });

      await Promise.allSettled(checkPromises);
    };

    executeChecks();

    return () => {
      isMounted = false;
      Object.values(timeoutIds).forEach((id) => clearTimeout(id));
    };
  }, [checks]);

  const allReady = Object.values(results).every((r) => !r.isLoading);
  const hasAnyError = Object.values(results).some((r) => r.error);
  const hasAnyTimeout = Object.values(results).some((r) => r.hasTimedOut);

  return {
    ...results,
    allReady,
    hasAnyError,
    hasAnyTimeout,
  };
}

// Helper para promisificar funcoes síncronas
async function checkPromise(fn: () => Promise<any>): Promise<any> {
  return fn();
}
