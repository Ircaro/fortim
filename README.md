# Fortim

Tower defense 2D no estilo flat minimalista, para navegador e celular. 5 fases, modo infinito, 6 torres com especializações, chefe, poderes especiais e som gerado por código. Feito em TypeScript + Vite, sem engine.

**Fortim** é um tower defense de visual limpo, feito para jogar no navegador do computador ou do celular. Os inimigos vêm em ondas pela trilha e você posiciona torres para impedir que eles cheguem ao castelo.

- **5 fases** com mapas diferentes: trilha que cruza sobre uma ponte, duas entradas ao mesmo tempo, castelo cercado no centro.
- **6 torres** (Arqueiros, Canhão, Gelo, Mago, Balista e Raio). No nível 4 cada uma se especializa em um de dois caminhos, e depois ganha melhorias sem limite.
- **Inimigos com fraquezas diferentes:** blindados, voadores, curandeiros, escudeiros, lodos que se dividem e o **Rei Goblin** como chefe.
- **Poderes especiais** (chuva de flechas, congelar e fúria) e a opção de chamar a próxima onda mais cedo em troca de ouro.
- **Campanha** com estrelas e desbloqueio de fases, **modo infinito** com recorde por fase, três dificuldades, conquistas e partida salva automaticamente.
- Gráficos desenhados e música gerada por código, sem nenhum arquivo de imagem ou som.

## Como rodar

Precisa do [Node.js](https://nodejs.org/) 20 ou mais novo.

```bash
npm install
npm run dev
```

Depois abra http://localhost:5181 no navegador.

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run build` | Gera a versão de produção em `dist/` |
| `npm run preview` | Serve a versão de produção localmente |
| `npm test` | Roda os testes (lógica da batalha, balanceamento por robôs, interface) |

## Como jogar

Escolha uma torre na loja e depois um espaço livre perto da trilha. No celular, toque uma vez para ver a prévia e o alcance e toque de novo no mesmo lugar para construir. Toque ou clique numa torre construída para melhorar, especializar, vender ou trocar o alvo. O **Guia** (ícone de livro) mostra o que funciona contra cada inimigo.

| Tecla | Ação |
|---|---|
| 1 a 6 | Escolher torre |
| Espaço | Iniciar onda |
| C | Chamar a próxima onda mais cedo |
| Q, W, E | Poderes (flechas, congelar, fúria) |
| U | Melhorar a torre selecionada |
| Delete | Vender a torre selecionada |
| P | Pausar |
| F | Velocidade 1x, 2x, 3x |
| M | Som |
| Esc | Cancelar |

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/sim` | Lógica da batalha, sem DOM, coberta por testes |
| `src/data` | Torres, inimigos, ondas, fases, dificuldade e poderes |
| `src/render` | Desenho do mapa e dos efeitos no canvas |
| `src/ui` | Interface em HTML e CSS |
| `src/audio` | Efeitos e música com Web Audio |
| `src/game` | Controle: liga a batalha, o desenho, a interface e a entrada |
