# Backlog do Fortim

## Para observar jogando

- **Difícil**: suavizado para vida dos inimigos +10%, ouro normal e 15 vidas. O robô bom vence as 5 fases, mas apertado (Cerco com 1 vida, Encruzilhada com 3). Ajustar pelo que o Írcaro sentir
- **Melhorias "+"**: a economia do "+" não foi validada pelos robôs (eles quase não compram). Ficar de olho se uma torre com muitos "+" deixa o jogo fácil demais
- **Celular deitado bem baixo** (667x375 e parecidos): a loja rola um pouco dentro da coluna, sem cortar nada
- **Celular de 360 px em pé**: os cards da loja mostram só ícone e preço (o nome aparece na ficha)

## Depois

- **Link fixo (Cloudflare Pages)**: hoje o teste no celular usa um túnel temporário do Cloudflare que só funciona com o computador ligado. Publicar no Pages exige login na conta Cloudflare do Írcaro
- **Ícones de app** (PNG 192/512 + manifest) junto com o link fixo
- **Torres candidatas**: Mina de Ouro (gera ouro por onda) e Torre de Veneno (dano contínuo, impede cura)
- **Cores fixas no código**: ponte, Rei Goblin e chamas usam cores fixas em `render/`; dá para levar para a `Palette`

## Feito

- **5 fases** com desbloqueio, estrelas de 1 a 3 e progresso salvo: Vale do Fortim, Floresta Sinuosa, Desfiladeiro (trilha cruza sobre uma ponte), Encruzilhada (2 entradas em zigue-zague), Cerco ao Fortim (castelo no centro, espirais dos dois lados)
- **Modos** Campanha e Infinito (escolhendo a fase, recorde de onda por fase); **dificuldade** Fácil, Normal e Difícil
- **Inimigos novos**: Curandeiro, Escudeiro, Lodo (divide em lodinhos); **chefe** Rei Goblin na onda 15 de cada fase (invoca goblins, barra de vida no topo); no infinito, chefe a cada 10 ondas a partir da 25
- **Poderes** Chuva de flechas (com mira no mapa), Congelar e Fúria, com recarga (Q, W, E); **chamar a onda antes** com bônus de ouro (C)
- **Torre de Raio** (salta entre inimigos, tecla 6)
- **Especialização no nível 4** em todas as torres (2 caminhos cada) e **melhorias "+"** sem limite depois dela (+12% de dano cada, custo crescendo 45%)
- **Menu novo** com o escudo, fases com miniatura, **Continuar** partida salva automaticamente a cada onda vencida, **tutorial** de 4 passos na primeira partida, **10 conquistas** e estatísticas
- Som no estilo "Suave e moderno" (marimba, sinos FM, reverberação, acordes em triângulo, baixo em seno). Referência em `docs/referencia-sons.html`
- Ajustes de som: liga/desliga e volume separados para música e efeitos, salvos no navegador
- Ficha da torre abre mesmo sem ouro, com aviso de quanto falta; próximo nível na própria linha ("Dano 10 → 17"); "Bom contra / Fraco contra"
- Ondas 12 a 15 do Vale aliviadas
- Prévia da próxima onda (lateral esquerda em telas a partir de 1300 px, abaixo do mapa nas menores) e Guia completo (inimigos, torres com especializações, poderes, atalhos)
- Ultrawide (21:9 e 32:9) com largura útil limitada; vidas com ícone de coração; cards da loja deitados em janelas baixas
- Visual fixo: só a paleta Noite e a fonte Outfit
