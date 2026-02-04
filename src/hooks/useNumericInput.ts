import { useState, useEffect, useCallback, useRef } from 'react';

const INPUT_TIMEOUT_MS = 2000; // 2 seconds to complete input

export function useNumericInput(onChannelSelect: (number: number) => void) {
  const [inputBuffer, setInputBuffer] = useState<string>('');
  const [isInputMode, setIsInputMode] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const clearInput = useCallback(() => {
    setInputBuffer('');
    setIsInputMode(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleDigit = useCallback((digit: string) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const newBuffer = inputBuffer + digit;
    setInputBuffer(newBuffer);
    setIsInputMode(true);

    // Parse and validate
    const number = parseInt(newBuffer, 10);

    // If we have a valid number, set timeout to confirm
    if (number > 0) {
      timeoutRef.current = setTimeout(() => {
        onChannelSelect(number);
        clearInput();
      }, INPUT_TIMEOUT_MS);
    }

    // If buffer is too long, clear it
    if (newBuffer.length >= 4) {
      clearInput();
    }
  }, [inputBuffer, onChannelSelect, clearInput]);

  const handleImmediateConfirm = useCallback(() => {
    if (inputBuffer) {
      const number = parseInt(inputBuffer, 10);
      if (number > 0) {
        onChannelSelect(number);
      }
      clearInput();
    }
  }, [inputBuffer, onChannelSelect, clearInput]);

  const handleKeyPress = useCallback((key: string) => {
    // Check if it's a digit
    if (key >= '0' && key <= '9') {
      handleDigit(key);
      return true;
    }

    // Enter confirms immediate selection
    if (key === 'Enter' && inputBuffer) {
      handleImmediateConfirm();
      return true;
    }

    // Escape cancels input
    if (key === 'Escape' && isInputMode) {
      clearInput();
      return true;
    }

    return false;
  }, [handleDigit, handleImmediateConfirm, clearInput, inputBuffer, isInputMode]);

  return {
    inputBuffer,
    isInputMode,
    handleKeyPress,
    clearInput
  };
}
