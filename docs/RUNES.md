# Sistema de Runas

## Decisões estabelecidas

- Todo item terá **8 slots de craft**.
- Os slots poderão receber **runas**.
- Cada runa adicionará **atributos ou efeitos** ao item em que for aplicada.
- As runas serão obtidas como **drops de monstros**.
- O sistema deverá funcionar com armas, armaduras e demais itens compatíveis com craft.

## Direção de design

O sistema deve transformar os equipamentos em bases personalizáveis. O item define sua identidade e comportamento principal; as oito runas permitem especializar seus atributos sem substituir essa identidade.

As probabilidades normais de drop precisam continuar separadas do botão temporário `DROP 100%`, que existe apenas para testes.

## Pontos para a próxima fase

- categorias e raridades das runas;
- atributos possíveis e limites por item;
- runas exclusivas de monstros, biomas ou chefes;
- regras para inserir, remover e substituir runas;
- custos do craft;
- combinações, bônus de conjunto e conflitos;
- apresentação dos oito slots no inventário;
- persistência e salvamento das runas aplicadas.

## Testes gráficos: Runa de Ataque

A opção de obsidiana foi escolhida como formato-base da Runa de Ataque. Duas convenções de raridade estão sendo comparadas antes da decisão final.

### Alternativa A — espada colorida

- a pedra permanece obsidiana em todas as raridades;
- somente a espada muda de cor;
- **Comum:** espada branca/prateada;
- **Rara:** espada azul;
- **Épica:** espada roxa;
- **Lendária:** espada dourada.

Arquivos em `public/assets/64/runes/attack/`.

### Alternativa B — pedra colorida com espada esculpida

- a espada não possui cor própria nem brilho;
- o símbolo é um baixo-relevo esculpido na própria pedra;
- um sulco escuro e uma borda clara do mesmo material formam a espada;
- somente a pedra muda conforme a raridade;
- **Comum:** pedra branca/prateada;
- **Rara:** pedra azul;
- **Épica:** pedra roxa;
- **Lendária:** pedra dourada.

Arquivos em `public/assets/64/runes/attack/stone_color/`.

Nenhuma das duas convenções é definitiva até a comparação visual.
