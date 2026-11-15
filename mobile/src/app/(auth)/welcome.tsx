import { router } from 'expo-router';
import { View } from 'react-native';
import { Logo } from '@/components/Logo';
import { Button, Icon, Row, Screen, Spacer, Txt } from '@/components/ui';
import { APP_NAME, APP_TAGLINE, colors } from '@/config';

const FEATURES: [React.ComponentProps<typeof Icon>['name'], string][] = [
  ['barbell-outline', 'Schede con libreria esercizi e video'],
  ['chatbubbles-outline', 'Chat diretta coach ↔ cliente'],
  ['trending-up-outline', 'Check-in, foto e progressi'],
];

export default function Welcome() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ alignItems: 'center', marginTop: 48 }}>
        <Logo size={96} />
        <Txt v="display" style={{ marginTop: 18 }}>{APP_NAME}</Txt>
        <Txt v="muted" style={{ marginTop: 4 }}>{APP_TAGLINE}</Txt>
      </View>
      <Spacer h={36} />
      {FEATURES.map(([icon, text]) => (
        <Row key={text} gap={14} style={{ marginBottom: 14, paddingHorizontal: 8 }}>
          <Icon name={icon} size={22} color={colors.accent} />
          <Txt>{text}</Txt>
        </Row>
      ))}
      <Spacer h={32} />
      <Button title="Ho un codice dal mio coach" icon="key-outline" onPress={() => router.push('/(auth)/signup-client')} />
      <Spacer h={10} />
      <Button title="Sono un personal trainer" variant="ghost" icon="briefcase-outline" onPress={() => router.push('/(auth)/signup-trainer')} />
      <Spacer h={22} />
      <Txt v="muted" center>Hai già un account?</Txt>
      <Button title="Accedi" variant="ghost" small onPress={() => router.push('/(auth)/login')} style={{ alignSelf: 'center', marginTop: 8, minWidth: 160 }} />
    </Screen>
  );
}
