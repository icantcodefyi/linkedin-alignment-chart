import { useEffect, useRef } from 'react';

type AnyFunction = (...args: any[]) => any;

export function useDebounce<T extends AnyFunction>(
    callback: T,
    delay: number
): (...args: Parameters<T>) => void {
    const callbackRef = useRef<T>(callback);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Update the callback ref when callback changes
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // Clear timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (...args: Parameters<T>) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            callbackRef.current(...args);
        }, delay);
    };
} 