/**
 * Loading spinner wrapper using ink-spinner.
 */

import { Text } from 'ink';
import Spinner from 'ink-spinner';

interface LoadingSpinnerProps {
  label?: string;
}

export const LoadingSpinner = ({ label = 'Loading...' }: LoadingSpinnerProps): JSX.Element => {
  return (
    <Text>
      <Text color="cyan">
        <Spinner type="dots" />
      </Text>
      <Text> {label}</Text>
    </Text>
  );
};
