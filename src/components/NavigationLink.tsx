'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import React from 'react';

interface NavigationLinkProps {
    to: string;
    className?: string | ((props: { isActive: boolean }) => string);
    children: React.ReactNode;
}

export function NavigationLink({ to, className, children }: NavigationLinkProps) {
    const pathname = usePathname();
    const isActive = pathname === to;

    const resolvedClassName = typeof className === 'function'
        ? className({ isActive })
        : cn(className, isActive && "text-primary bg-primary/10");

    return (
        <Link href={to} className={resolvedClassName}>
            {children}
        </Link>
    );
}
