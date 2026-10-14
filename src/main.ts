import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/outfit/800.css';
import './game/base.css';
import { startGame } from './game';
import { applyCssVars } from './theme';

async function main(): Promise<void> {
  applyCssVars();
  try {
    await document.fonts.ready;
  } catch {
    void 0;
  }
  startGame(document.getElementById('app'));
}

void main();
