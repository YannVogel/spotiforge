import {
  DECADES,
  type Decade,
  FORGE_LIMITS,
  type ForgeLength,
  SHAPES,
  type Shape,
} from '@spotiforge/shared';
import { StyleSheet, View } from 'react-native';

import { DISCOVERY_STEP, LENGTH_STEP } from '../../domain/draft';
import { Chip, HeatBar, SegmentButton, Text } from '../../ui';
import { space } from '../../ui/theme';
import { CREATE_COPY } from './copy';

function SettingHeader({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.header}>
      <Text variant="label" color="textSoft" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="value" importantForAccessibility="no" accessibilityElementsHidden>
        {value}
      </Text>
    </View>
  );
}

export function LengthSetting({
  length,
  onChange,
}: {
  length: ForgeLength;
  onChange: (value: number) => void;
}) {
  const copy = CREATE_COPY.length;
  const inMinutes = length.unit === 'minutes';
  const { min, max } = FORGE_LIMITS.length[length.unit];
  return (
    <View style={styles.section}>
      <SettingHeader
        title={copy.title}
        value={inMinutes ? copy.minutes(length.value) : copy.tracks(length.value)}
      />
      <HeatBar
        min={min}
        max={max}
        step={LENGTH_STEP[length.unit]}
        value={length.value}
        onChange={onChange}
        accessibilityLabel={inMinutes ? copy.a11yMinutes : copy.a11yTracks}
        accessibilityValueText={
          inMinutes ? copy.a11yValueMinutes(length.value) : copy.a11yValueTracks(length.value)
        }
      />
    </View>
  );
}

export function DiscoverySetting({
  discovery,
  onChange,
}: {
  discovery: number;
  onChange: (value: number) => void;
}) {
  const copy = CREATE_COPY.discovery;
  return (
    <View style={styles.section}>
      <SettingHeader title={copy.title} value={copy.value(discovery)} />
      <HeatBar
        min={FORGE_LIMITS.discovery.min}
        max={FORGE_LIMITS.discovery.max}
        step={DISCOVERY_STEP}
        value={discovery}
        onChange={onChange}
        accessibilityLabel={copy.a11y}
        accessibilityValueText={copy.a11yValue(discovery)}
      />
      <View style={styles.legend}>
        <Text variant="meta" color="textSoft">
          {copy.cold}
        </Text>
        <Text variant="meta" color="textSoft">
          {copy.hot}
        </Text>
      </View>
    </View>
  );
}

export function DecadeChoices({
  selected,
  onToggle,
}: {
  selected: readonly Decade[];
  onToggle: (decade: Decade) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="list" accessibilityLabel={CREATE_COPY.decades}>
      {DECADES.map((decade) => (
        <Chip
          key={decade}
          label={decade}
          selected={selected.includes(decade)}
          onPress={() => onToggle(decade)}
        />
      ))}
    </View>
  );
}

export function ShapeChoices({
  shape,
  onSelect,
}: {
  shape: Shape;
  onSelect: (shape: Shape) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={CREATE_COPY.shape}>
      {SHAPES.map((value) => (
        <SegmentButton
          key={value}
          label={CREATE_COPY.shapes[value]}
          selected={shape === value}
          onPress={() => onSelect(value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row', gap: space.xs },
});
