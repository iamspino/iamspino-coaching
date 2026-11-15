import { useLocalSearchParams } from 'expo-router';
import { CheckInDetail } from '@/components/CheckInDetail';

export default function TrainerCheckIn() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CheckInDetail id={id} asTrainer />;
}
