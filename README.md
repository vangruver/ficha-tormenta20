# Ficha de Tormenta 20 automatizada

Ficha de personagem de **Tormenta 20** (Jogo Básico) que preenche sozinha o máximo possível a
partir de **raça + classe + origem + nível**, com um compêndio pesquisável de poderes, magias,
equipamentos, ameaças (bestiário) e panteão. Roda 100% no navegador — publicável no
**GitHub Pages** sem back-end. Feita no mesmo esquema da [ficha de D&D 5e](https://github.com/vangruver/dnd-sheet),
adaptado para as regras de Tormenta 20.

## O que ela faz

- **Painel de automação** (aba Construção): cada benefício que raça, classe, origem e nível concedem
  vira um bloco. O que é fixo já vem aplicado; o que o livro manda escolher fica marcado como
  pendência até você decidir — e o topo do painel conta quantas pendências sobraram:
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
  5etools para D&D. As **perícias iniciais das 14 classes** (as fixas, o "uma ou outra" e quantas
  ficam à escolha) e os **PV/PM por nível** foram conferidos contra o SRD de T20; ainda assim vale
  revisar contra o livro antes de usar em mesa. Os campos de perícias sugeridas por origem são um
  palpite razoável, não a lista oficial exata.
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
| `index.html` / `assets/style.css` | interface e tema "papel" |
| `src/database.js` | carrega `data/core` + `data/raw` e expõe as consultas (poderes, magias, equipamentos, ameaças, panteão) |
| `src/rules.js` | atributos, perícias, PV/PM, defesa, compra de atributos, leitura de armadura — fórmulas de Tormenta 20 |
| `src/app.js` | interface, abas, painel de automação, rolagens e sala |
| `src/storage.js` | personagens em `localStorage` (múltiplos slots + ativo), importar/exportar |
| `sync-data.mjs` | baixa o Tormenta20 Compendium e gera `data/raw/*.json` + `data/version.json` |
| `data/core/*.json` | raças, classes, perícias, atributos, origens — regras centrais digitadas à mão |
| `data/raw/*.json` | poderes, magias, equipamentos, panteão, ameaças — gerado pelo `sync-data.mjs` |
| `data/raw/golem-*.json` | conteúdo de fã (não-oficial) para a raça Golem — veja "Conteúdo de fã (opcional)" acima |

## Limitações conhecidas

- Os traços raciais em `data/core/racas.json` foram digitados a partir do livro básico — revise
  antes de usar em mesa (veja "Fonte dos dados" acima).
- Perícias sugeridas por origem são um palpite temático, não a lista oficial fixa do livro.
- Equipamento inicial de classe/origem não é adicionado automaticamente ao inventário.
- **Traços raciais condicionais** (o +2 do anão só no subterrâneo, o +5 de Furtividade do trog só
  sem armadura, o +2 num Ofício à escolha do kliren) não entram sozinhos — o painel de automação
  avisa e você soma no campo "outros" da perícia quando valer.
- **Requisitos de poder** são texto livre no compêndio: a ficha só consegue conferir requisito de
  nível, de atributo e de "treinado em X"; o resto passa sem checagem.
- **Limite de magias conhecidas/preparadas por círculo e nível** ainda não é calculado — a aba
  Magias deixa escolher livremente.
- Escolhas específicas (ex.: esfera de milagres do Clérigo, caminho do Arcanista, forma selvagem do
  Druida) ainda não têm seletor dedicado — use as Notas ou o campo de biografia.
- **Bestiário do compêndio na escala d20**: PV, Defesa e atributos das ameaças vêm do material
  antigo e não batem com a escala de T20; a ficha mostra o modificador equivalente, mas não
  reescreve as fichas de ameaça.
