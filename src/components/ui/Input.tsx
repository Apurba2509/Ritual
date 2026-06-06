import React, { useState } from 'react';
import { TextInput, TextInputProps, View, Text, StyleSheet } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = ({ label, error, style, className, ...props }: InputProps) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className={`w-full mb-4 ${className || ''}`}>
      {label && (
        <Text style={styles.label} className="font-stat mb-2">
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
        className="rounded-xl px-4 h-14 justify-center"
      >
        <TextInput
          style={styles.input}
          className="font-body"
          placeholderTextColor="#9CA3AF"
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
      </View>
      {error && (
        <Text style={styles.errorText} className="font-body mt-1">
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    color: '#9CA3AF', // textSecondary
  },
  inputContainer: {
    backgroundColor: '#1E2333',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  inputFocused: {
    backgroundColor: 'rgba(124, 58, 237, 0.05)', // surface1
    borderColor: '#7C3AED', // primary
  },
  inputError: {
    borderColor: '#EF4444', // danger
  },
  input: {
    color: '#F9FAFB', // textPrimary
    fontSize: 16,
    height: '100%',
  },
  errorText: {
    color: '#EF4444', // danger
    fontSize: 14,
  },
});
