import { useLocalSearchParams } from 'expo-router';
import { LogDetail } from '@/components/LogDetail';

export default function ClientLog() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LogDetail id={id} asTrainer={false} />;
}
