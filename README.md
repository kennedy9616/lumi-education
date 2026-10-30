# LUMI Education

AVA estático em HTML, CSS e JavaScript, sem instalação de dependências ou etapa de compilação. O layout toma como referência o curso de Redes e reúne as áreas de Educação Infantil, Universidade e Ensino Técnico do catálogo original.

## Abrir o site

Abra `index.html` ou use um servidor estático, como o Live Server do VS Code. Um servidor local é recomendado para compartilhar as preferências entre as páginas e usar recursos como gravação de áudio. O acesso ao microfone continua dependendo da autorização do navegador.

## Organização

```text
index.html                         Painel e catálogo de cursos
configuracoes/index.html           Tema, cor de destaque e movimento
biblioteca/index.html              Aulas e atividades disponíveis
infantil/index.html                Área de Educação Infantil
tecnico/index.html                 Área de Ensino Técnico
universidade/index.html            Área de Universidade
template/                         Somente arquivos CSS
  tokens.css                      Cores e variáveis compartilhadas
  base.css                        Componentes do AVA de Redes
  layout.css                      Cabeçalho, navegação e estrutura
  activity.css                    Integração dos palcos interativos
  pages/                          Estilos específicos de cada página/aula
  vendor/katex.css                Tipografia matemática existente
scripts/
  theme.js                        Preferências, carregadas antes do CSS
  site.js                         Cabeçalho e menu compartilhados
  dashboard.js                    Busca, filtros e endereços antigos
  settings.js                     Controles de aparência
  icons.js                        Ícones SVG locais
  lessons/                        Interações das aulas existentes
  vendor/katex.min.js              Renderização matemática existente
assets/images/                    Imagens extraídas das aulas
```

Todas as 13 pastas de cursos que estavam vazias receberam um `index.html`, com o nome do curso, status “Em breve” e navegação de volta ao catálogo. Leitura e Processos Estocásticos também receberam índices. O endereço `universidade/redes-de-computadores/redes-index.html` foi preservado.

## Alterar o visual

- Edite `template/tokens.css` para alterar as cores globais, fontes e arredondamento.
- Edite `template/layout.css` para mudar o menu e a estrutura comum.
- Edite `template/base.css` para mudar cartões, botões, tabelas e componentes de aula.
- Use `template/pages/` para particularidades de uma aula. Evite repetir regras de tema nesses arquivos.
- A página `configuracoes/index.html` oferece tema claro, escuro ou do sistema; destaque dourado, azul, verde ou violeta; e redução de animações do portal.

As preferências usam `lumi-preferences` no armazenamento local. As antigas chaves `lumi-theme` e `lumi-tema` são lidas para migrar a escolha anterior. Nenhuma preferência é enviada a um servidor. Sem acesso ao armazenamento, as alterações continuam funcionando na página atual.

## Padrão das páginas

Cada página do portal usa HTML sem blocos `<style>`, scripts inline ou atributos `style`/eventos. O `<head>` carrega `scripts/theme.js`, os três CSS compartilhados, os CSS específicos e os scripts com `defer`.

O `body` informa `data-root` (caminho relativo até a raiz) e `data-area` (`inicio`, `infantil`, `universidade`, `tecnico`, `biblioteca` ou `configuracoes`). `scripts/site.js` preenche os elementos `data-site-header` e `data-site-sidebar`. Um `<template id="course-navigation">` opcional fornece a navegação específica do curso.

Para criar um curso, copie um dos índices “Em breve”, atualize o conteúdo e adicione seu cartão ao catálogo da raiz e ao índice da área. Use um identificador `data-course="area/slug"`, `data-category` e `data-available` para a busca e os filtros. Quando publicar novas aulas, atualize também a biblioteca e os contadores da página inicial.

## Atividades interativas

Os endereços originais de Leitura, dos capítulos 7 e 8 e da aula de Zener e LED agora abrem o ambiente do aluno com a atividade incorporada. Os arquivos `*-atividade.html` guardam o palco da aula; `scripts/lessons/` mantém os jogos, simulações, síntese de voz e exercícios. Há controles para tela cheia e acesso direto.

Os palcos preservam suas cores didáticas, o contraste dos gráficos e o formato de apresentação. O entorno segue o tema global. A redução de movimento do portal desativa animações CSS; as simulações possuem seus controles pedagógicos próprios. KaTeX e os ícones são locais; o portal e as apresentações ainda podem consultar o Google Fonts, com fontes alternativas quando offline.

## Verificar alterações

Com Node.js disponível, execute:

```sh
node scripts/check-site.mjs
```

O verificador confere links, âncoras, IDs, separação de CSS/JS, sintaxe dos scripts e o comportamento das preferências de tema. A inspeção visual em computador e celular deve complementar essas verificações.

## Publicação no GitHub Pages

O site é publicado em https://kennedy9616.github.io/lumi-education/ a partir da branch `main`, pasta raiz (`/`). O arquivo `.nojekyll` mantém a publicação como site estático.

A aula de Eletrônica Analógica está em `universidade/eletronica-analogica/exemplo-zenner-led.html`. O nome do arquivo foi mantido para preservar seu endereço.

Para atualizar após editar os arquivos, execute na pasta do repositório:

```sh
node scripts/check-site.mjs
git add .
git commit -m "Atualiza aulas da LUMI"
git push origin main
```

O GitHub Pages publica automaticamente os próximos commits da branch `main`. O andamento fica disponível na aba Actions do repositório.
