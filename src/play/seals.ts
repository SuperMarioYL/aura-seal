import type { EffectKind } from '../effects/types';
import type { Seal } from '../vision/seals/sealTypes';

// Overhaul P4 — seal spells: a short ordered sequence of seals cast within a time window
// triggers a stronger "遁术" effect. The sequencer prefix-matches the running chain and
// self-recovers (drops stale leading seals) when a wrong seal breaks every spell prefix.
export interface SealSpell {
  id: string;
  name: string;
  seals: Seal[];
  effect: EffectKind;
}

export const SEAL_SPELLS: SealSpell[] = [
  { id: 'fire', name: '火遁·豪火球', seals: ['yin', 'wu', 'zi'], effect: 'aura_burst' },
  { id: 'thunder', name: '雷遁·麒麟', seals: ['you', 'mao', 'wu'], effect: 'beam' },
  { id: 'water', name: '水遁·水龙弹', seals: ['chen', 'zi', 'wu'], effect: 'energy_orb' },
  { id: 'wind', name: '风遁·真空波', seals: ['mao', 'yin'], effect: 'slash' },
];

const STEP_GAP_MS = 1600;
const TOTAL_WINDOW_MS = 4500;

export interface SealProgress {
  chain: Seal[];
  candidates: SealSpell[]; // spells whose prefix equals the current chain
  nextSeals: Seal[]; // possible next seals (hints)
}

export interface SealCast {
  spell: SealSpell;
}

function seqEq(a: Seal[], b: Seal[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

function isPrefixOf(prefix: Seal[], full: Seal[]): boolean {
  return prefix.length <= full.length && prefix.every((s, i) => s === full[i]);
}

function unique(seals: Seal[]): Seal[] {
  return [...new Set(seals)];
}

export class SealSequencer {
  private chain: Seal[] = [];
  private lastTs = -Infinity;
  private startTs = 0;

  push(seal: Seal, ts: number): { progress: SealProgress; cast: SealCast | null } {
    if (ts - this.lastTs > STEP_GAP_MS || ts - this.startTs > TOTAL_WINDOW_MS) {
      this.chain = [];
    }
    if (this.chain.length === 0) {
      this.startTs = ts;
    }
    this.lastTs = ts;
    this.chain.push(seal);

    // Drop stale leading seals until the chain is again a prefix of some spell.
    while (this.chain.length > 0 && !this.anyPrefix(this.chain)) {
      this.chain.shift();
    }

    const full = SEAL_SPELLS.find((s) => seqEq(s.seals, this.chain));
    if (full) {
      this.chain = [];
      return { progress: this.progress(), cast: { spell: full } };
    }
    return { progress: this.progress(), cast: null };
  }

  private anyPrefix(chain: Seal[]): boolean {
    return SEAL_SPELLS.some((s) => isPrefixOf(chain, s.seals));
  }

  private progress(): SealProgress {
    const candidates = SEAL_SPELLS.filter((s) => isPrefixOf(this.chain, s.seals));
    const nextSeals = unique(
      candidates.map((s) => s.seals[this.chain.length]).filter((s): s is Seal => Boolean(s)),
    );
    return { chain: [...this.chain], candidates, nextSeals };
  }

  reset() {
    this.chain = [];
    this.lastTs = -Infinity;
  }
}
