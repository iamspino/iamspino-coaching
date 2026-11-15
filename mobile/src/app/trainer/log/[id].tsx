import { useLocalSearchParams } from 'expo-router';
import { LogDetail } from '@/components/LogDetail';

export default function TrainerLog() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LogDetail id={id} asTrainer />;
}
