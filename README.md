# Ficha de Tormenta 20 automatizada

Ficha de personagem de **Tormenta 20** (Jogo Básico) que preenche sozinha o máximo possível a
partir de **raça + classe + origem + nível**, com um compêndio pesquisável de poderes, magias,
equipamentos, ameaças (bestiário) e panteão. Roda 100% no navegador — publicável no
**GitHub Pages** sem back-end. Feita no mesmo esquema da [ficha de D&D 5e](https://github.com/vangruver/dnd-sheet),
adaptado para as regras de Tormenta 20.

## O que ela faz

- **Automação da ficha** a partir de raça, classe, origem e nível:
  - **PV e PM máximos** por classe/nível (fórmula inicial + por nível, ajustada por Constituição/atributo-chave);
  - **Defesa, iniciativa, deslocamento e carga máxima** calculados a partir dos atributos finais (base + bônus racial);
  - **Atributos raciais** aplicados automaticamente ao trocar de raça (mostra o valor final e o bônus separadamente, sem sobrescrever o que você digitou);
  - **Perícias** (as 29 do sistema, incluindo Fortitude/Reflexos/Vontade como perícias) com bônus calculado e marcação de "só treinado";
  - **Testes de resistência** e **ataques** com botão de rolagem (1d20 + perícia).
- **Compêndio completo pesquisável**: poderes (de classe, raciais, de origem, gerais e concedidos),
  magias (por círculo/tipo), equipamentos, **ameaças** (bestiário com ND, PV, Defesa, atributos) e
  panteão — mais de 1.400 registros ao todo.
- **PV/PM com dashboard fixo**: barra de PV colorida, botões de dano/cura, gasto de PM, botão de
  descanso que restaura tudo.
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
- **Raças, classes, perícias, atributos e origens (`data/core/*.json`)**: digitados à mão a partir
  do livro Tormenta 20 - Jogo Básico, porque não existe uma fonte de dados aberta e "viva" como o
  5etools para D&D. **Os números de progressão de classe (PV/PM por nível) são uma estimativa
  revisada com cuidado, mas não conferida linha a linha com o livro — vale a pena revisar contra o
  original antes de usar em mesa.** Os campos de perícias sugeridas por origem também são um
  palpite razoável, não a lista oficial exata.

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
| `src/rules.js` | atributos, perícias, PV/PM, defesa — fórmulas de Tormenta 20 |
| `src/app.js` | interface, abas, automação da ficha |
| `src/storage.js` | personagens em `localStorage` (múltiplos slots + ativo), importar/exportar |
| `sync-data.mjs` | baixa o Tormenta20 Compendium e gera `data/raw/*.json` + `data/version.json` |
| `data/core/*.json` | raças, classes, perícias, atributos, origens — regras centrais digitadas à mão |
| `data/raw/*.json` | poderes, magias, equipamentos, panteão, ameaças — gerado pelo `sync-data.mjs` |

## Limitações conhecidas (v1)

- Os números de PV/PM por classe e os traços raciais em `data/core/` foram digitados de memória a
  partir do livro básico — revise antes de usar em mesa (veja "Fonte dos dados" acima).
- Perícias sugeridas por origem são um palpite temático, não a lista oficial fixa do livro.
- Equipamento inicial de classe/origem não é adicionado automaticamente ao inventário.
- Bônus de armadura/escudo na Defesa é manual (campo "outros") — não é extraído automaticamente da
  descrição em texto livre dos itens do compêndio.
- Escolhas específicas (ex.: esfera de milagres do Clérigo, escola do Arcanista, forma selvagem do
  Druida) ainda não têm seletor dedicado — use as Notas ou o campo de biografia.
