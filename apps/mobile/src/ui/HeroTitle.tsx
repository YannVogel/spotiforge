import NativeMaskedView from '@react-native-masked-view/masked-view';
import type { ComponentType, ReactElement } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Text } from './Text';
import { gradients } from './theme';

// Les types livrés avec masked-view 0.3.2 combinent deux constructeurs et ne sont plus reconnus
// comme composant avec les types de React Native 0.88 : on redonne sa signature au composant.
const MaskedView = NativeMaskedView as unknown as ComponentType<
  ViewProps & { maskElement: ReactElement }
>;

type HeroTitleProps = {
  /** Texte du titre ; `\n` force un retour à la ligne. Un seul `HeroTitle` par écran. */
  children: string;
};

/** Grand titre d'écran, rempli par le dégradé `heading`. */
export function HeroTitle({ children }: HeroTitleProps) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={children.replace(/\n/g, ' ')}>
      <MaskedView maskElement={<Text variant="hero">{children}</Text>}>
        {/* Le texte invisible donne sa taille au dégradé, que le masque découpe en lettres. */}
        <View style={styles.gradient}>
          <Text variant="hero" style={styles.invisible}>
            {children}
          </Text>
        </View>
      </MaskedView>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: { backgroundImage: gradients.heading },
  invisible: { opacity: 0 },
});
