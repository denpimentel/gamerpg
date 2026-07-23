# GameRPG Sprite Generator

Ferramenta web simples para montar sprites em camadas e exportar PNGs no tamanho usado pelo GameRPG.

## Como usar

1. Abra `index.html` no navegador.
2. Defina largura e altura do canvas.
3. Ajuste a escala do personagem ou monstro.
4. Selecione a âncora. Para personagens e monstros, use normalmente **Centro inferior**.
5. Adicione PNGs transparentes em ordem: corpo, armadura, arma, efeitos.
6. Reordene as camadas com as setas.
7. Clique em **Exportar PNG**.

Também é possível arrastar PNGs diretamente para a área de preview.

## Recursos disponíveis nesta versão

- Canvas configurável entre 8 e 1024 pixels.
- Escala de 0,25× a 4×.
- Âncoras `bottom-center`, `center` e `top-left`.
- Identificação da direção: sul, oeste, leste e norte.
- Múltiplas camadas PNG/WebP.
- Mostrar, ocultar, reordenar e remover camadas.
- Renderização sem suavização para preservar pixel art.
- Exportação PNG transparente.

## Próximos passos

- Projetos com quatro direções simultâneas.
- Recorte de frames de spritesheets existentes.
- Timeline para `idle`, `walk`, `attack`, `hurt` e `death`.
- Exportação de spritesheet completa e arquivo JSON de metadados.
- Biblioteca de corpos, armaduras, armas, monstros e efeitos do próprio GameRPG.
