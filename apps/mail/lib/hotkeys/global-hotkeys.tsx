import { useCommandPalette } from '@/components/context/command-palette-context';
import { useDirectActions } from '@/hooks/use-direct-actions';
import { enhancedKeyboardShortcuts } from '@/config/shortcuts';
import { useShortcuts } from './use-hotkey-utils';
import { useQueryState } from 'nuqs';

export function GlobalHotkeys() {
  const [, setComposeOpen] = useQueryState('isComposeOpen');
  const { clearAllFilters } = useCommandPalette();
  const [, setIsCommandPaletteOpen] = useQueryState('isCommandPaletteOpen');
  const scope = 'global';

  const handlers = {
    newEmail: () => setComposeOpen('true'),
    commandPalette: () => setIsCommandPaletteOpen('true'),
    clearAllFilters: () => clearAllFilters(),
  };

  const globalShortcuts = enhancedKeyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(globalShortcuts, handlers, { scope });

  return null;
}
