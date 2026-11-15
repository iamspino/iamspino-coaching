import { useLocalSearchParams } from 'expo-router';
import { CheckInDetail } from '@/components/CheckInDetail';

export default function ClientCheckIn() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CheckInDetail id={id} asTrainer={false} />;
}
