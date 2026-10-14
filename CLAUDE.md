# Fortim: instruções para o Claude

Jogo pessoal do Írcaro: tower defense 2D no estilo flat minimalista (formas geométricas, cores chapadas, sombras longas), em TypeScript + Vite, sem engine. O mapa é desenhado em `<canvas>` e a interface é HTML/CSS. Rodar com `npm run dev` (http://localhost:5181).

## Estrutura

- `src/core/types.ts`: contratos (torres, inimigos, ondas, mapa, estado da batalha e `BattleApi`)
- `src/config.ts`: constantes (tile lógico de 48 px, mapa 16x10, ouro e vidas iniciais)
- `src/theme.ts`: paleta Noite (a única) e a fonte Outfit (a única). Não oferecer troca de paleta nem de fonte
- `src/data/`: números do jogo (torres com especializações, inimigos, ondas, fases em `stages.ts`, dificuldade, poderes, ondas infinitas, guia). Balanceamento mexe aqui e é conferido por robôs em `src/sim/balance.test.ts`
- `src/core/progress.ts`: estrelas, desbloqueio, recordes do infinito e conquistas, salvos no navegador; `src/sim/save.ts` salva a partida a cada onda vencida
- `src/sim/`: lógica pura da batalha, sem DOM, coberta por testes
- `src/audio/`: efeitos e música gerados com WebAudio
- `src/render/`: desenho do mapa, torres, inimigos e efeitos no canvas
- `src/ui/`: interface HTML (barra de status, loja de torres, ficha da torre, menus)

## Regras

- Responder em pt-BR, com acentuação correta, sem travessão e sem jargão de IA
- Código sem comentários, inclusive nos testes
- Nunca fazer commit ou push sem ele pedir. Commits sem linha de coautoria
- Responsivo: tem que funcionar bem no celular (toque, retrato e paisagem, botões de no mínimo 44 px) e no computador (mouse e teclado)
- Visual: manter o flat minimalista aprovado; mudança visual nova vira amostra pequena para ele aprovar antes
- Depois de mudar código: `npx tsc --noEmit` e `npx vitest run`
- Para conferir algo visual, pedir um print ao Írcaro em vez de tirar screenshots
