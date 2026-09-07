# Ficha de Tormenta 20 automatizada

Ficha de personagem de **Tormenta 20** (Jogo Básico) que preenche sozinha o máximo possível a
partir de **raça + classe + origem + nível**, com um compêndio pesquisável de poderes, magias,
equipamentos, ameaças (bestiário) e panteão. Roda 100% no navegador — publicável no
**GitHub Pages** sem back-end. Feita no mesmo esquema da [ficha de D&D 5e](https://github.com/vangruver/dnd-sheet),
adaptado para as regras de Tormenta 20.

## Aviso: projeto de fã, sem fins lucrativos

Esta ficha é um **projeto de fã, não-oficial e sem fins lucrativos**. Não tem anúncio, cobrança,
assinatura nem qualquer monetização — o código é aberto e ela roda de graça no navegador.

**Tormenta 20** e tudo de Arton (raças, classes, poderes, magias, ameaças, divindades) pertencem à
**Jambô Editora** e aos autores do sistema. Este projeto **não é afiliado, endossado nem aprovado**
por eles. O que fica versionado aqui são as *estatísticas* do sistema — números e listas, que são
fatos de regra — nunca o texto dos livros: as descrições da ficha são resumos mecânicos curtos
escritos para ela.

**Se você joga Tormenta 20, compre os livros.** A ficha não substitui nenhum deles; ela só organiza
o personagem de quem já joga. Se você tem direito sobre algum conteúdo aqui e quer que saia, abra
uma Issue no repositório explicando o pedido.

## O que ela faz

- **Assistente guiado de criação** (aba Construção → "Assistente guiado"): dez passos na ordem em
  que o livro monta a ficha — raça, classe, origem, divindade, nível, atributos, perícias e traços,
  poderes, equipamento e uma revisão final com PV/PM/Defesa/iniciativa calculados. Cada passo traz
  cartões pesquisáveis com o resumo do que a opção concede, e as marcas de ✓ mostram o que já está
  resolvido. Os passos de atributos, perícias e equipamento **reaproveitam os mesmos painéis** das
  abas Ficha/Construção/Equipamentos (eles são movidos pra dentro do assistente e devolvidos ao
  sair), então não existem duas versões da mesma lógica.
- **Quatro métodos de geração de atributos** (aba Ficha, ou passo "Atributos" do assistente):
  - **compra de pontos** — os 10 pontos do livro, com o custo por valor e quanto sobra;
  - **arranjo padrão** — quatro conjuntos prontos que já fecham o orçamento;
  - **rolagem** — 4d6 descartando o menor, seis vezes; o resultado sai na escala do d20 (3–18) e é
    convertido pra escala de T20 por *(valor − 10) ÷ 2*. Os dados de cada rolagem ficam visíveis no
    tooltip do valor;
  - **valores livres** — sem orçamento nenhum, pra reproduzir uma ficha pronta ou um NPC.
  Nos modos de arranjo e rolagem os valores viram uma piscina que você distribui pelos atributos
  num `<select>` por atributo (trocar um valor de lugar troca os dois automaticamente).
- **Gerador de personagem** (menu Personagem → "Gerador de personagem"): trava o que você já
  decidiu (raça, classe, origem, nível, nome) e sorteia o resto. Ele distribui os atributos
  favorecendo o atributo-chave da classe, resolve **todas** as escolhas do painel de automação,
  veste a melhor armadura que o personagem aguenta carregar, empunha escudo e arma coerentes com a
  classe, cria a linha de ataque e enche PV/PM — o resultado é uma ficha sem pendências.
- **Seletor de armadura, escudo e armas** (aba Equipamentos, e também na aba Combate e no
  assistente): em vez de caçar a armadura no catálogo geral misturada com tesouros e consumíveis,
  cada função tem sua própria lista com Defesa, penalidade e peso à mostra. Equipar entra na Defesa
  na hora; escolher uma arma cria a linha de ataque com a perícia certa.
- **Painel de automação** (aba Construção): cada benefício que raça, classe, origem e nível concedem
  vira um bloco. O que é fixo já vem aplicado; o que o livro manda escolher fica marcado como
  pendência até você decidir — e o topo do painel conta quantas pendências sobraram. **Escolha que
  não tem alternativa real não vira pendência**: quando a lista de opções tem exatamente o tamanho
  da cota (a origem que sugere 2 perícias e treina 2, o grupo "uma ou outra" com uma opção só, a
  origem com um único poder correspondente), a ficha aplica sozinha e marca o bloco como
  *aplicado* em vez de pedir uma decisão que não existe:
  - **atributos raciais à escolha** (o "+1 em três atributos" do humano, do lefou, do osteon e da
    sereia) e o **legado** do suraggel (Aggelus/Sulfure), com os bônus entrando na hora;
  - **perícias treinadas**: as fixas da classe entram sozinhas, o "Luta **ou** Pontaria" vira uma
    escolha, as livres são *número da classe + modificador de Inteligência*, a origem treina 2 e
    algumas raças treinam mais. Perícia concedida por duas fontes aparece marcada como repetida;
  - **poder de origem** e **poderes por nível** (um poder de classe no 2º nível e um a cada nível
    seguinte), com contador de quantos ainda faltam;
  - **traços raciais numéricos** aplicados sem você fazer nada: +2 em Misticismo/Percepção do elfo,
    +3/+1 PV do anão, +1 PM por nível do elfo, +2 de Defesa do golem, e por aí.
- **Contas do sistema** feitas pela ficha:
  - **PV e PM máximos** por classe/nível (PV soma Constituição, PM não soma atributo nenhum);
  - **Defesa** com armadura e escudo **equipados**, **penalidade de armadura** descontada de
    Acrobacia, Furtividade e Ladinagem, **iniciativa** como perícia, deslocamento e carga carregada;
  - **Perícias** (as 29 do sistema, incluindo Fortitude/Reflexos/Vontade) com o bônus do livro:
    *metade do nível + atributo + treino (+2, +4 no 7º nível, +6 no 15º)*;
  - **Compra de atributos**: mostra quantos dos 10 pontos iniciais você usou.
- **PM gasto de verdade**: em T20 não existe "espaço de magia" — tudo se paga em Pontos de Mana.
  O botão **Conjurar** de cada magia e o **Usar** dos 174 poderes com custo (Fúria, Aparar,
  Inspiração…) descontam a mana sozinhos, recusam quando falta e registram no histórico de rolagens.
  O **círculo máximo por nível** (1º no 1º nível e um novo a cada quatro) trava as magias que ainda
  não liberaram, marcando em que nível cada uma entra.
- **Condições que mexem nos números**: aplicar *Abalado* tira −2 de perícias e ataques, *Exausto*
  tira −6 de Força e Destreza e corta o deslocamento pela metade, *Indefeso* fixa a Defesa em 5,
  *Paralisado* trata Destreza como 0. Condição sem efeito numérico (Apavorado, Confuso) continua
  valendo como lembrete e aparece marcada como tal. Junto delas há **modificadores temporários**
  criados à mão (o "+2 em tudo" de uma bênção, o "−1 na Defesa" de um item), que entram nas mesmas
  contas.
- **Multiclasse**: reparta o nível total entre classes. PV e PM contam a repartição — só a classe
  inicial dá o pacote do 1º nível, e cada nível seguinte usa o valor por nível da classe em que foi
  ganho. As perícias fixas das classes novas entram sozinhas.
- **Ficha em PDF de duas páginas**: um layout A4 de papel de verdade (identidade, atributos,
  Defesa/PV/PM, as 29 perícias em duas colunas, ataques na página 1; poderes, magias, equipamento,
  condições e anotações na página 2), com pré-visualização em tela antes de imprimir.
- **Retrato, XP e parceiros**: foto do personagem guardada na própria ficha, campo de experiência e
  um acompanhamento de aliados e montarias (PV e anotações de cada um), com atalho a partir dos
  poderes *Aliado:* e *Montaria:* que o personagem tiver.
- **Rolagens**: perícias, atributos, testes de resistência, ataques (com margem de crítico da arma) e
  **dano** (com o multiplicador aplicado no crítico), além de um **rolador de dados** no menu
  Ferramentas — expressões livres (`2d6+3`) e os testes da ficha a um clique, com ou sem sala.
- **Equipamento com efeito**: equipar armadura/escudo entra na Defesa e na penalidade; uma arma
  vira linha de ataque pronta, com dano, margem e multiplicador de crítico.
- **Subir de nível** com um botão que aplica o nível e lista o que mudou (PV, PM, poder novo,
  metade do nível, bônus de treino) e o que ficou pendente.
- **Compêndio completo pesquisável**: poderes (de classe, raciais, de origem, gerais e concedidos),
  magias (por círculo/tipo), equipamentos, **ameaças** (bestiário com ND, PV, Defesa, atributos) e
  panteão — mais de 1.400 registros ao todo.
- **PV/PM com dashboard fixo**: barra de PV colorida, botões de dano/cura, gasto de PM, penalidade
  de armadura, botão de descanso que restaura tudo e botão de subir de nível.
- **Condições de combate**: as condições oficiais de T20, com efeito descrito.
- **Múltiplos personagens salvos**, **importar/exportar em JSON** e **ficha em PDF** (via impressão
  do navegador).
- **Quatro temas**: *Noite* (escuro, padrão), *Mesa* (escuro e compacto, pra ficha aberta durante a
  sessão), *Papel Branco* e *Pergaminho*. Toda a folha de estilo lê só tokens semânticos, então
  nenhuma cor fica presa a um tema — as perícias treinadas, por exemplo, são realçadas pela cor de
  acento do tema em vez de um creme fixo que sumia no escuro.
- **Cache offline e instalável (PWA)**: service worker cacheia a casca do app e os dados, dá pra
  instalar no celular/desktop e abrir offline.
- **Sincronização diária**: um workflow do GitHub Actions baixa a versão mais nova do compêndio
  todo dia às 05h (horário de Brasília) e grava em `data/raw/`. Quando há uma sincronização nova, um
  aviso aparece no topo da página.

## Fonte dos dados

- **Poderes, magias, equipamentos, panteão e ameaças**: [Tormenta20 Compendium](https://github.com/Kull4ck/tormenta20-compendium),
  um módulo não-oficial para Foundry VTT (tag `0.7.8`, que ainda tinha os pacotes base, combinada
  com o conteúdo extra da branch `master`). Os arquivos `.db` (NeDB — um JSON por linha) são
  baixados e normalizados em `data/raw/*.json` pelo script `sync-data.mjs`.
- **Bestiário extra (`data/raw/ameacas-extra.json`, ~1.850 criaturas)**: adicionado manualmente numa
  sessão anterior a partir do compêndio de Foundry VTT "Coleção Arton - Ameaças" (aventuras da
  Jornada Heroica e outros suplementos oficiais de Tormenta 20). Ao contrário de `ameacas.json`,
  este arquivo **não** é regerado pelo `sync-data.mjs`, então é o lugar certo para curadoria manual —
  qualquer entrada adicionada aqui sobrevive à sincronização automática. O livro **Ameaças de Arton**
  (Jambô Editora, 2023) já está integralmente coberto por esse compêndio (na pasta "Coleção Arton -
  Ameaças de Arton", com nomes às vezes grafados de forma inconsistente, ex.: "Hynnin"/"Hyninn",
  "Kallyandranoch"/"Kallyadranoch"); uma conferência criatura a criatura contra o PDF oficial não
  encontrou nenhum stat block faltando, então nenhuma entrada nova precisou ser adicionada a partir
  dele. Como de costume neste arquivo, os campos `descricao` ficam vazios — o texto de lore dos
  livros é conteúdo comercial protegido, então só os números e habilidades mecânicas são mantidos.
- **Progressão por nível (`data/core/conjuracao.json`, `data/core/habilidades-classe.json`)**:
  quantas magias cada classe conjuradora conhece em cada nível, até que círculo ela alcança, e as
  habilidades que a classe concede sozinha ao subir. Geradas pelo
  [`sync-tabelas.mjs`](sync-tabelas.mjs), que **chama** as funções de progressão do Fichas de Nimb
  para os níveis 1 a 20 e anota o resultado — são funções puras do nível, então o que sai é a tabela
  do livro, não a implementação dele.

  Isso corrigiu um erro real da ficha: a fórmula genérica tratava todo mundo como conjurador pleno,
  e **Bardo e Druida são meio-conjuradores** — só alcançam o 2º círculo no 9º nível e param no 4º,
  enquanto Arcanista e Clérigo chegam ao 5º. O Arcanista ainda tem uma tabela por Caminho: Mago,
  Bruxo e Feiticeiro aprendem quantidades diferentes de magias.
- **Suplementos (`data/core/*-suplementos.json`, `data/raw/deuses-menores.json`)**: raças, classes,
  origens e divindades de **Heróis de Arton**, **Ameaças de Arton** e **Deuses de Arton**, geradas
  pelo script [`sync-suplementos.mjs`](sync-suplementos.mjs) a partir do mesmo checkout do Fichas de
  Nimb — 34 raças (Centauro, Ogro, Orc, Tengu, Harpia, Duende, Galokk…), 2 classes (Treinador e
  Frade), 30 origens e 63 deuses menores. Ficam em arquivos separados dos do livro básico e cada
  registro carrega `suplemento: true`, então dá para jogar só com o Jogo Básico desligando
  **"Incluir suplementos"** na aba Construção (o que o personagem já escolheu nunca some).

  Como no `sync-core.mjs`, só entram fatos de regra. O campo `traços` de cada raça é **montado pelo
  script a partir dos números** — bônus de atributo, tamanho, deslocamento, e o nome de cada traço
  com o efeito numérico que ele declara ("Cascos (arma natural 1d8)") — em vez de reproduzir a
  descrição. Nem a prosa dos livros nem a redação do Nimb entra aqui.
- **Origens regionais (`data/raw/origens-regionais.json`, 66 origens)**: digitadas à mão a partir do
  apêndice "Origens Regionais" do livro **Atlas de Arton** (Jambô Editora, 2023). São origens
  ligadas a um reino/cultura específico de Arton (ex.: Amazona de Hippion, Legionário, Liricista de
  Lenórienn), por isso ficam num arquivo e numa chave (`origensRegionais`) separados das 34 origens
  comuns de `data/core/origens.json` — não fazem sentido para qualquer personagem, só para quem é
  nativo (ou cresceu) no local indicado. Como de costume, o campo `beneficio` traz só um resumo
  mecânico curto, sem reproduzir a prosa/flavor text do livro. O trecho do Atlas de Arton disponível
  para extração cobre principalmente esse apêndice final (páginas ~468–479) mais alguns capítulos de
  geografia/história (sem uso mecânico para a ficha); não foi possível conferir se o livro completo
  (480 páginas) foi coberto.
- **Raças, classes, perícias, atributos e origens (`data/core/*.json`)**: digitados à mão a partir
  do livro Tormenta 20 - Jogo Básico, porque não existe uma fonte de dados aberta e "viva" como o
  5etools para D&D, e depois **conferidos contra o [Fichas de Nimb](https://github.com/YuriAlessandro/gerador-ficha-tormenta20)**
  (Yuri Alessandro Martins, código sob licença MIT), outro projeto de fã de T20 que mantém essas
  tabelas. A conferência é feita pelo script [`sync-core.mjs`](sync-core.mjs), que lê um checkout do
  Nimb, aponta divergência campo a campo e nunca sobrescreve nada em silêncio. O resultado:
  - **PV, PM e número de perícias treinadas das 14 classes batem integralmente** entre os dois
    projetos — só o Arcanista diverge (1 perícia à escolha aqui, 2 no Nimb) e continua marcado
    abaixo como pendente de conferência no livro;
  - **as perícias sugeridas por origem, que este README chamava de "palpite temático", batem uma a
    uma com o Nimb nas 35 origens** — deixaram de ser palpite;
  - quatro classes ganharam perícias de classe que faltavam aqui (Bucaneiro, Caçador, Cavaleiro e
    Clérigo);
  - entraram campos que não existiam: **proficiências de armadura/arma e prioridade de atributos**
    por classe, e o **equipamento inicial** de cada origem.

  Só entram números e listas — estatísticas do sistema, que são fatos de regra. O texto descritivo
  de cada traço continua sendo um resumo mecânico curto escrito para esta ficha; nem a prosa dos
  livros nem a redação do Nimb é copiada.
- **Escala de atributos**: a ficha usa a escala de Tormenta 20, em que **o valor do atributo já é o
  modificador** (Força 2 soma +2) — não existe a conversão `(valor − 10) ÷ 2` do d20. Fichas salvas
  antes dessa correção são convertidas automaticamente na primeira vez que abrem.
- **Atributos das ameaças**: o compêndio traz o bestiário com atributos na escala d20 (8–20), e não
  na de T20. A ficha mostra os dois lado a lado no bloco da ameaça (`FOR 16 (+3)`) em vez de fingir
  que o número já é o modificador.

### Conteúdo de fã (opcional)

- **`data/raw/golem-chassis.json`, `data/raw/golem-poderes-fa.json`, `data/raw/golem-origens-fa.json`**:
  conteúdo extra para a raça Golem (chassis, poderes/talentos e origens) extraído do *Manual do
  Golem T20 (BETA 6, playtest)*, um material de **fã, não-oficial**, sem qualquer vínculo com a
  Jambô Editora. Fica em arquivos e chaves (`golemChassis`, `golemPoderesFa`, `golemOrigensFa`)
  separados de tudo o que vem do livro básico ou do compêndio oficial — nada aqui é misturado às
  listas oficiais de poderes/origens (`data/raw/poderes.json`, `data/core/origens.json`), e todo
  registro carrega um campo `fonte` deixando essa origem clara. Use com o aval do mestre da sua
  mesa. A lista de chassis extraída cobre só uma parte do que o manual descreve (a extração do PDF
  usada aqui se interrompeu no chassi "de Couro"); veja `data/raw/golem-chassis.json` para o que já
  está digitalizado.

## Publicar no GitHub Pages

1. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
2. O workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) publica a cada push.
3. Abra a URL `https://<usuário>.github.io/<repo>/`.

O arquivo `.nojekyll` garante que a pasta `src/` seja servida sem processamento do Jekyll.

## Rodar localmente

```bash
python -m http.server 8000
# abra http://localhost:8000
```

Precisa ser servido por HTTP (os módulos ES não carregam via `file://`).

## Atualizar o banco de dados manualmente

```bash
node sync-data.mjs
node tests/smoke.mjs   # confere se os números batem com o esperado
```

## Estrutura

| Arquivo | Papel |
|---|---|
| `index.html` / `assets/style.css` | interface e os quatro temas (Noite, Mesa, Papel, Pergaminho) |
| `src/database.js` | carrega `data/core` + `data/raw` e expõe as consultas (poderes, magias, equipamentos, ameaças, panteão) |
| `src/rules.js` | atributos, perícias, PV/PM, defesa, compra/arranjo/rolagem de atributos, leitura de armadura — fórmulas de Tormenta 20 |
| `src/app.js` | interface, abas, assistente guiado, painel de automação, gerador de personagem, equipamento, rolagens e sala |
| `src/storage.js` | personagens em `localStorage` (múltiplos slots + ativo), importar/exportar |
| `sync-data.mjs` | baixa o Tormenta20 Compendium e gera `data/raw/*.json` + `data/version.json` |
| `sync-core.mjs` | confere `data/core/*.json` contra o Fichas de Nimb e completa os campos que faltam |
| `sync-suplementos.mjs` | gera as raças, classes, origens e deuses dos suplementos a partir do mesmo checkout |
| `sync-tabelas.mjs` | tabela a progressão de magias e as habilidades de classe por nível |
| `data/core/*.json` | raças, classes, perícias, atributos, origens e escolhas obrigatórias de classe — regras centrais digitadas à mão |
| `data/raw/*.json` | poderes, magias, equipamentos, panteão, ameaças — gerado pelo `sync-data.mjs` |
| `data/raw/golem-*.json` | conteúdo de fã (não-oficial) para a raça Golem — veja "Conteúdo de fã (opcional)" acima |

## Limitações conhecidas

- Os traços raciais em `data/core/racas.json` foram digitados a partir do livro básico — revise
  antes de usar em mesa (veja "Fonte dos dados" acima).
- **Arcanista**: aqui a classe treina 1 perícia à escolha (mais Inteligência) e no Fichas de Nimb
  são 2. Não deu para resolver sem o livro à mão — se você conferir, o valor fica em
  `treinosIniciais` no `data/core/classes.json`.
- Três classes listam perícias de classe que o Fichas de Nimb não lista (Bucaneiro: Diplomacia,
  Intuição e Ladinagem; Caçador: Investigação e Vontade; Clérigo: Intimidação). Ficaram como estão,
  porque o script só acrescenta o que falta e nunca remove — vale conferir no livro.
- Equipamento inicial de classe/origem não é adicionado automaticamente ao inventário quando você
  monta o personagem à mão — só o **gerador** veste armadura, escudo e arma sozinho.
- **Traços raciais condicionais** (o +2 do anão só no subterrâneo, o +5 de Furtividade do trog só
  sem armadura, o +2 num Ofício à escolha do kliren) não entram sozinhos — o painel de automação
  avisa e você soma no campo "outros" da perícia quando valer.
- **Requisitos de poder** são texto livre no compêndio: a ficha só consegue conferir requisito de
  nível, de atributo e de "treinado em X"; o resto passa sem checagem.
- **Habilidades de classe** (`data/core/habilidades-classe.json`) entram como *nome e nível* — a
  ficha mostra o que já liberou e o que vem a seguir, mas o texto de cada uma está no livro.
- **Escolhas obrigatórias de classe** têm seletor para o Caminho do Arcanista e o Caminho do
  Cavaleiro, declarados em `data/core/escolhas-classe.json`. As demais famílias do compêndio
  (Postura de Combate, Missa, Forma Selvagem, Julgamento Divino…) **não** são escolhas de nível —
  são poderes pegos com as vagas normais e já aparecem na aba Poderes. Se você conferir no livro
  que alguma outra classe tem escolha obrigatória, basta acrescentar a entrada no arquivo: não
  precisa de código novo.
- **Dinheiro inicial** é o mesmo para todas as classes (T$ 60) porque a tabela por classe não foi
  conferida contra o livro; ajuste à mão se a sua mesa usar valores diferentes.
- O **bloco de regras dos parceiros** (ataques e habilidades do aliado/montaria por nível) não é
  calculado — a ficha acompanha PV e anotações, e o texto fica no compêndio.
- **Bestiário do compêndio na escala d20**: PV, Defesa e atributos das ameaças vêm do material
  antigo e não batem com a escala de T20; a ficha mostra o modificador equivalente, mas não
  reescreve as fichas de ameaça.
