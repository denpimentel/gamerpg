# ⚔️ GameRPG Lab — Bancada & Laboratório de Criação de Sprites 2D Top-Down

**GameRPG Lab** é um laboratório completo e bancada de testes visuais para jogos RPG 2D top-down (estilo Tibia / retro Zelda em grade 64×64).

O projeto foi feito para ser **100% estático, sem build e sem backend**: você apenas roda um servidor HTTP simples (ex.: Python `http.server`) e já pode testar o jogo, experimentar novos visuais e jogar tanto no PC quanto no celular via rede local!

---

## 🌟 Destaques & O que está incluído

Este repositório vem pronto com uma vasta biblioteca de packs e assets recortados, otimizados e organizados para jogos 2D:

### 🗺️ 1. Packs de Mapas & Terrenos (Grade 64×64)
- **4 Biomas integrados no demo principal (`Ilha de Elmsong`)**:
  - **Campo / Grama**: Terreno plano com pontes, árvores e vegetação.
  - **Deserto**: Areia com decorações de pedra e rochas.
  - **Pedra / Elevação**: Montanhas e relevos em camadas.
  - **Neve (IA)**: Bioma nevado com pinheiros e tilesets gerados via PixelLab.
- **Autotiling & Elementos Dinâmicos**:
  - Lagos com água animada e efeito de espuma (`foam ring`).
  - Pontes de madeira nos eixos horizontal e vertical.
  - Sombra de elevação e transição suave entre biomas.

### 👤 2. Sistema Paper Doll Modular (Personagem)
- **Troca de Equipamentos em Tempo Real**:
  - **Camadas**: `corpo` → `cabeça` → `pés` → `pernas` → `torso` → `arma`.
  - **Armaduras trocáveis (DOM / Inventário)**: Roupa simples, Couro, Cota de Malha, Armadura de Placa e Veste de Mago.
  - **Armas trocáveis**: Espada longa, Adaga, Maça, Machado de guerra e Lança.
  - Animações sincronizadas de caminhada (`walk`) e ataque (`slash`/`thrust`).

### 🐎 3. Sistema de Montarias (LPC + IA)
- **5 Cavalos LPC**: Cinza, Dourado, Marrom, Preto e Branco com animações de cavalgada e investida.
- **Montarias de IA**: Porco Rosa ✦IA e Slime domado.
- Encaixe automático do cavaleiro (corte de cintura + pernas de montaria) com ajuste de velocidade (até 260px/s) e recolhimento de armas.

### 👾 4. Packs de Monstros & Criaturas (20+ espécies com Animações)
Organizados por bioma em `public/assets/64/creatures/`:
- **Campo**: Bunny (Coelho), Chicken (Galinha), Mushroom (Cogumelo), Plant, Slime, Trunk (Tronco).
- **Deserto**: AngryPig, Bat (Morcego), Bee (Abelha), Radish (Rábano), Rock1, Rock2.
- **Pedra / Caverna**: Skull (Caveira), Ghost (Fantasma), Goblin de Tocha, Goblin de TNT.
- **Neve**: Snow Bear (Urso), Snow Wolf (Lobo), Ice Golem (Golem de Gelo), Yeti.
- **Comum**: Ovelhas e Cavaleiro.

### 🏰 5. Construções, Props & UI
- **Edificações**: Casa Azul (detalhada com sombra), Torre Goblin animada (4 frames), Castelo e Casas de madeira.
- **HUD Retrô**: Moldura estilo pergaminho pixel-art com barras de HP, Ouro, Idade/Nível, suporte a toque / joystick virtual no mobile e suporte a teclado WASD/Setas + Espaço no PC.

---

## 🎨 Laboratório de Criação de Sprites (Pipeline de IA & Scripts)

Além de ser um demo jogável, este repositório é um **LAB de criação de sprites**. Em `scripts/` você encontra ferramentas Python prontas para processar, montar e gerar novos spritesheets:

| Script | Função |
|---|---|
| `scripts/pixellab-route.py` | Roteador de API keys do [PixelLab](https://pixellab.ai) com balanceamento de saldo. |
| `scripts/gen_neve.py` | Pipeline de geração por IA para biomas completos (tilesets, árvores, monstros e herói). |
| `scripts/gen_montaria.py` | Transforma qualquer monster/sprite em uma montaria cavalgável com ajuste automático de bob de altura. |
| `scripts/build_mounts.py` | Processa e ajusta os spritesheet de cavalos LPC (Scale2x 2×). |
| `scripts/process_ai_house.py` | Processa construções geradas por IA (chroma key, recortes, sombras). |
| `scripts/gen_ui_icons.py` | Desenha ícones pixel-art programaticamente via PIL/Pillow. |

---

## 🚀 Como Rodar Localmente

Não precisa instalar `node`, `npm` ou fazer qualquer build! Basta servir a pasta `public/`:

### 1. Iniciar o servidor local
No terminal, dentro da pasta do projeto:

```bash
# Servir a pasta public na porta 8310
python3 -m http.server 8310 --directory ./public
```

### 2. Acessar no Navegador
- **No PC:** Abra `http://localhost:8310` ou `http://localhost:8310/demo64/`
- **No Celular (mesma Wi-Fi):** Abra `http://<IP-DO-SEU-PC>:8310/demo64/`

---

## 🔑 Configuração de Chaves de IA (Opcional)

Se quiser usar as ferramentas de geração por IA via PixelLab ou OpenRouter:

1. Copie o arquivo de exemplo:
   ```bash
   cp .env.example .env
   ```
2. Adicione sua chave da [PixelLab API](https://api.pixellab.ai) e/ou [OpenRouter](https://openrouter.ai) no arquivo `.env`.

*Nota: O jogo em si e todos os assets inclusos funcionam 100% sem precisar de nenhuma API Key!*

---

## 📜 Licenças & Créditos

- **Código do Projeto & Scripts**: Licenciados sob a [MIT License](LICENSE).
- **Assets de Terceiros**:
  - **Pixel Adventure 1 & 2**: CC0 (Domínio Público).
  - **Universal LPC Spritesheets**: CC-BY-SA 3.0 / GPL 3.0.
  - **LPC Horses**: CC-BY 3.0 / GPL 3.0 / OGA-BY 3.0 (bluecarrot16).
  - **Tiny Swords**: Uso pessoal e comercial livre (Pixel Frog).
  - **Phaser 4**: MIT License.

Veja a lista detalhada com links e atribuições em [`CREDITS.md`](CREDITS.md).
