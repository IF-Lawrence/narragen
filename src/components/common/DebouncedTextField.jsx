import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TextField } from '@mui/material';

/**
 * A TextField with debounced onChange callback
 * Uses internal state for immediate UI response, then calls parent's onChange after debounce
 * This prevents the parent component from re-rendering on every keystroke
 */
const DebouncedTextField = ({
    value: externalValue,
    onChange,
    debounceMs = 300,
    ...props
}) => {
    // Internal state for immediate UI response
    const [internalValue, setInternalValue] = useState(externalValue || '');
    const timeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    // Sync internal state when external value changes (but not while typing)
    useEffect(() => {
        if (!isTypingRef.current) {
            setInternalValue(externalValue || '');
        }
    }, [externalValue]);

    const handleChange = useCallback((e) => {
        const newValue = e.target.value;
        isTypingRef.current = true;
        setInternalValue(newValue);

        // Clear previous timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new timeout to call parent's onChange
        timeoutRef.current = setTimeout(() => {
            isTypingRef.current = false;
            if (onChange) {
                onChange({ target: { value: newValue } });
            }
        }, debounceMs);
    }, [onChange, debounceMs]);

    // Handle blur - immediately sync to parent
    const handleBlur = useCallback((e) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        isTypingRef.current = false;
        if (onChange && internalValue !== externalValue) {
            onChange({ target: { value: internalValue } });
        }
        // Call original onBlur if provided
        if (props.onBlur) {
            props.onBlur(e);
        }
    }, [onChange, internalValue, externalValue, props.onBlur]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <TextField
            {...props}
            value={internalValue}
            onChange={handleChange}
            onBlur={handleBlur}
        />
    );
};

export default DebouncedTextField;
