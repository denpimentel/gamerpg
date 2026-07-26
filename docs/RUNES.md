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

### Alternativa B — molde de forja colorido

- não existe uma espada desenhada ou preenchida;
- a pedra funciona como uma matriz de forja;
- uma cavidade profunda no formato da espada contém lâmina, guarda, cabo e pomo;
- paredes chanfradas e sombra interna reforçam o espaço negativo do molde;
- somente a pedra muda conforme a raridade;
- **Comum:** pedra branca/prateada;
- **Rara:** pedra azul;
- **Épica:** pedra roxa;
- **Lendária:** pedra dourada.

Arquivos em `public/assets/64/runes/attack/stone_color/`.

Nenhuma das duas convenções é definitiva até a comparação visual.

## Protótipo da Forja Rúnica

- A forja é acessada ao se aproximar do **Ferreiro Rúnico** e interagir com ele.
- Cada runa pode ser evoluída do nível 1 ao 10 usando **GOLD**.
- O nível aumenta o atributo e a chance de encaixe. No protótipo, a chance começa
  em 85% no nível 1 e chega a 100% no nível 10.
- O magma percorre as oito runas em sequência. Runas aprovadas entram no encaixe
  correspondente; runas reprovadas quebram e são consumidas.
- A bandeja abre ao clicar no ícone **CRAFT** do Ferreiro Rúnico.
- O jogador arrasta manualmente o item e as runas do inventário para a forja.
- Antes das runas, o item recebe magma e tem 70% de chance de sobreviver. Se quebrar,
  o processo termina. Se sobreviver, o magma percorre os oito slots.
- Moldes aprovados permanecem preenchidos com magma; moldes reprovados permanecem
  no slot como fragmentos quebrados.
- Runas são clicadas na BAG e ocupam automaticamente o próximo encaixe livre.
- A barra de equipamentos possui 8 slots fixos na tela, no estilo de uma hotbar.
- A BAG de runas começa com 16 slots e poderá ser expandida até 28 por itens com
  runa de ingrediente.
- A animação possui um botão **SKIP**.
- Ao terminar, a única ação disponível é sair da forja. Uma nova interação com o
  Ferreiro inicia uma sessão de craft limpa.

Os custos, atributos e a curva de chance atuais são valores de teste para balanceamento.
