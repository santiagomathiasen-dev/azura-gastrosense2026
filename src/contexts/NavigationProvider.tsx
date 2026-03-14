'use client';

import * as React from 'react';
import { NavigationContext, NavigateFunction } from './NavigationContext';

export function NavigationProvider({
    children,
    navigate
}: {
    children: React.ReactNode;
    navigate: NavigateFunction;
}) {
    return (
        <NavigationContext.Provider value={{ navigate }}>
            {children}
        </NavigationContext.Provider>
    );
}
