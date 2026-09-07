# `escolhas-classe.json` — escolhas obrigatórias de classe

Cada entrada declara uma escolha que a classe **obriga** a fazer num nível
específico, e aponta para uma *família* de poderes do compêndio (poderes cujo
nome começa com `<familia>:`, como `Caminho do Arcanista: Mago`). As opções
não são digitadas aqui — saem do próprio `data/raw/poderes.json`, então
continuam certas quando o compêndio é sincronizado.

Campos:

| campo | papel |
|---|---|
| `classe` | id da classe em `classes.json` |
| `id` | identificador da escolha dentro da classe (chave em `escolhas.escolhasClasse`) |
| `nome` | rótulo mostrado no painel de automação e no assistente |
| `familia` | prefixo dos poderes do compêndio que são as opções |
| `nivel` | nível em que a escolha passa a ser exigida |
| `obrigatorio` | se `true`, vira pendência enquanto não for escolhida |

## Por que só duas entradas

Só estão aqui as escolhas de classe que dá para afirmar com segurança a partir
do livro básico **e** que têm família correspondente no compêndio: o Caminho do
Arcanista e o Caminho do Cavaleiro.

As outras famílias que existem no compêndio — `Postura de Combate` (Cavaleiro),
`Armadilha` (Caçador), `Missa` (Clérigo), `Forma Selvagem` (Druida),
`Virtude Paladinesca` e `Julgamento Divino` (Paladino), `Dobrador` — **não**
são escolhas obrigatórias de 1º nível: são poderes de classe que você pega com
as vagas normais de poder, e por isso já aparecem na aba Poderes. Colocá-las
aqui inventaria uma regra que o livro não tem.

Se você conferir no livro que alguma outra classe tem escolha obrigatória de
nível (a esfera de milagres do Clérigo, o inimigo predileto do Caçador), basta
acrescentar a entrada — a ficha não precisa de código novo, desde que exista
uma família de poderes correspondente no compêndio.
