import { useLocalSearchParams } from 'expo-router';
import { ReviewDetail } from '@/components/ReviewDetail';

export default function TrainerReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReviewDetail id={id} />;
}
