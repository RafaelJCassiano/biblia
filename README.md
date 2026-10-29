# Leitura Guiada

App instalável (PWA) para ler o Novo Testamento capítulo a capítulo, com estudo em quatro passos
(observação, contextualização, interpretação, aplicação), notas por versículo e resumo.

- Funciona sem internet depois da primeira abertura.
- As anotações ficam no aparelho e, se você entrar numa conta, também no Supabase (vários aparelhos).
- O texto bíblico **não está neste repositório** (tem direitos autorais). Ele fica num bucket privado do Supabase
  e é baixado uma vez, depois de você entrar.

## Passo 1: Supabase

1. Crie um projeto em <https://supabase.com>.
2. Abra **SQL Editor**, cole o conteúdo de `schema.sql` e execute. Isso cria a tabela `estudos`
   (com RLS, cada pessoa só enxerga as próprias anotações) e o bucket privado `biblia`.
3. Abra **Storage > biblia** e envie o arquivo `biblia-acf.json` (entregue à parte, fora deste repositório).
4. Abra **Project Settings > API** e copie a **Project URL** e a chave **anon / publishable**.
   Cole os dois em `config.js`. Nunca use a chave `service_role`.
5. **Authentication > Providers > Email**: deixe ativado. Depois de criar a sua conta no app,
   desative **Allow new users to sign up** para ninguém mais criar conta.
6. **Authentication > URL Configuration**: em **Site URL**, coloque o endereço do seu GitHub Pages (passo 2).

## Passo 2: GitHub

1. Crie um repositório (por exemplo `biblia`) e, em **Add file > Upload files**, envie **todos os arquivos desta pasta**
   (não há subpastas, então basta selecionar tudo de uma vez). **Não envie o `biblia-acf.json`**.
2. Em **Settings > Pages**, em **Source**, escolha **Deploy from a branch**, branch `main` e pasta `/ (root)`.
3. Em um ou dois minutos o app fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
   A cada novo envio de arquivos, o endereço é atualizado sozinho.

## Passo 3: instalar no celular

1. Abra o endereço do Pages no Chrome do Android, entre com e-mail e senha (ou crie a conta).
2. O app baixa o texto bíblico uma vez. Depois, menu ⋮ e **Instalar app**.
3. No iPhone: Compartilhar e **Adicionar à Tela de Início**.

Se algo aparecer com erro 404 no console, confira se todos os arquivos foram enviados ao repositório.

Sem configurar o Supabase, o app ainda funciona: na primeira abertura ele pede para você importar o arquivo
`biblia-acf.json`, e as anotações ficam só naquele aparelho.

## Trazer as anotações da versão anterior

Na versão antiga: **Meus resumos > Copiar backup**. No app instalado: **Meus resumos > Importar backup**,
cole o texto e toque em **Importar**. Se estiver logado, as anotações sobem para a conta.
Use também **Baixar arquivo** de tempos em tempos como cópia de segurança.

## Atualizar o app nos aparelhos

Depois de mudar qualquer arquivo, aumente `VERSION` em `sw.js` (por exemplo de `v2` para `v3`) antes de enviar.

## Observações

- O Supabase gratuito pausa projetos sem uso por cerca de uma semana. Abrir o app de vez em quando evita isso.
- Os links "Abrir na NAA" levam ao site Bíblia Online. O texto da NAA não é copiado para o app.
- Conteúdo de estudo (temas, perguntas, referências, contexto dos livros): `guia.json` e `contexto.json`.
