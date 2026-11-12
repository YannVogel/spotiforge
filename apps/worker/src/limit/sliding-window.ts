/** Au plus `max` passages sur toute période glissante de `windowMs`. */
export type WindowLimit = { max: number; windowMs: number };

export type SlotVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type SlotDecision = {
  verdict: SlotVerdict;
  /** Passages encore dans la fenêtre, à garder pour la prochaine décision (ordre croissant). */
  timestamps: number[];
};

/**
 * Fenêtre glissante : un passage est accepté s'il y en a eu moins de `max` dans les `windowMs`
 * précédentes, et seuls les passages acceptés comptent. Un refus indique dans combien de secondes
 * une place se libère.
 */
export function takeSlot(
  timestamps: readonly number[],
  now: number,
  { max, windowMs }: WindowLimit,
): SlotDecision {
  const recent = timestamps.filter((time) => time > now - windowMs).sort((a, b) => a - b);
  if (recent.length < max) {
    return { verdict: { allowed: true }, timestamps: [...recent, now] };
  }

  // Si la limite a baissé depuis les derniers passages, il faut en voir sortir plusieurs.
  const oldestBlocking = recent[recent.length - max] ?? now;
  const retryAfterSeconds = Math.ceil((oldestBlocking + windowMs - now) / 1000);
  return { verdict: { allowed: false, retryAfterSeconds }, timestamps: recent };
}
