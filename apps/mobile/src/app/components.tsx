import { DECADES, type Decade, SHAPES, type Shape } from '@spotiforge/shared';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AlloySwitch,
  Chip,
  HeatBar,
  HeroTitle,
  OreField,
  PrimaryButton,
  SecondaryButton,
  SegmentButton,
  Wordmark,
} from '../ui';
import { colors, size, space } from '../ui/theme';

// Textes tirés de la maquette Création.
const SHAPE_LABELS: Record<Shape, string> = {
  rise: 'Montée',
  fall: 'Descente',
  wave: 'Vague',
  free: 'Libre',
};

/** Écran de démonstration des composants (développement seulement) : `spotiforge://components`. */
export default function ComponentsDemoScreen() {
  const [ore, setOre] = useState('Route de nuit au bord de la mer.');
  const [alloy, setAlloy] = useState(true);
  const [decades, setDecades] = useState<Decade[]>(['80s', '00s', '10s']);
  const [shape, setShape] = useState<Shape>('rise');
  const [minutes, setMinutes] = useState(40);
  const [discovery, setDiscovery] = useState(60);

  if (!__DEV__) return <Redirect href="/" />;

  const toggleDecade = (decade: Decade) =>
    setDecades((current) =>
      current.includes(decade) ? current.filter((d) => d !== decade) : [...current, decade],
    );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Wordmark />
        <HeroTitle>{'Qu’est-ce\nqu’on\nforge ?'}</HeroTitle>
        <OreField label="Le minerai — ton moment" value={ore} onChangeText={setOre} />
        <AlloySwitch label="Alliage : mes écoutes" value={alloy} onValueChange={setAlloy} />
        <HeatBar
          min={10}
          max={120}
          step={5}
          value={minutes}
          onChange={setMinutes}
          accessibilityLabel="Durée en minutes"
          accessibilityValueText={`${minutes} minutes`}
        />
        <HeatBar
          min={0}
          max={100}
          step={10}
          value={discovery}
          onChange={setDiscovery}
          accessibilityLabel="Part de découverte en pourcentage"
        />
        <View style={styles.row}>
          {DECADES.map((decade) => (
            <Chip
              key={decade}
              label={decade}
              selected={decades.includes(decade)}
              onPress={() => toggleDecade(decade)}
            />
          ))}
        </View>
        <View style={styles.row} accessibilityRole="radiogroup">
          {SHAPES.map((value) => (
            <SegmentButton
              key={value}
              label={SHAPE_LABELS[value]}
              selected={shape === value}
              onPress={() => setShape(value)}
            />
          ))}
        </View>
        <SecondaryButton label="Reforger 5 titres" onPress={() => {}} />
        <SecondaryButton label="Reforger 5 titres" onPress={() => {}} disabled />
        <PrimaryButton label="Forger la playlist" onPress={() => {}} />
        <PrimaryButton label="Forger la playlist" onPress={() => {}} disabled />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: size.screenPadding, gap: space.lg },
  row: { flexDirection: 'row', gap: space.xs },
});
