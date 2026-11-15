import { router, useLocalSearchParams } from 'expo-router';
import { ExerciseList } from '@/components/ExerciseList';
import { Button, Screen, Spacer, notify } from '@/components/ui';
import { errorMessage, supabase } from '@/lib/supabase';
import type { Exercise } from '@/lib/types';

export default function PickExercise() {
  const { workoutId, position } = useLocalSearchParams<{ workoutId: string; position: string }>();

  async function pick(e: Exercise) {
    const { data, error } = await supabase.from('workout_exercises')
      .insert({ workout_id: workoutId, exercise_id: e.id, position: Number(position) || 0 }).select('id').single();
    if (error) return notify('Errore', errorMessage(error));
    // apre subito la modifica di serie e ripetizioni
    router.replace(`/trainer/wex/${data.id}`);
  }

  return (
    <Screen>
      <ExerciseList onSelect={pick} header={
        <>
          <Button title="Crea nuovo esercizio" icon="add" variant="ghost" small onPress={() => router.push('/trainer/exercise/new')} />
          <Spacer />
        </>
      } />
    </Screen>
  );
}
