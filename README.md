# Garimpo — comparador de preços com chat de IA

**Garimpo** (antes "Monitor de Preços") procura o preço de um produto em **8 lojas brasileiras** conversando com o
Claude, que pesquisa na internet. O nome vem de "garimpar": procurar com calma até achar o melhor preço.
Tem duas versões: **com tela** (React) e **de terminal** (Python).

**Lojas:** Mercado Livre · Amazon Brasil · Magazine Luiza · Americanas · Shopee · Casas Bahia · Kabum · AliExpress

| O que faz | Tela | Terminal |
|---|:---:|:---:|
| Chat com IA (pergunta o que falta antes de pesquisar) | ✅ | ✅ |
| Preços nas 8 lojas, do menor para o maior, com a economia | ✅ | ✅ |
| Filtro por loja e "só frete grátis" | ✅ | — |
| Comparação em barras e preços das suas buscas anteriores | ✅ | — |
| Favoritos (até 5), histórico (20) e alertas — guardados | ✅ | ✅ |
| Aviso quando o preço chega no alvo | na tela | no terminal e por e-mail |
| Temas Escuro, Claro e Noturno | ✅ | — |

## Versão com tela (`MonitorPreco.jsx`)

Foi feita para rodar como **artefato no Claude.ai**: cole o arquivo numa conversa e peça para abrir como artefato.
Lá a pesquisa funciona sem chave no código.

> Fora do Claude.ai, **não** coloque a chave da API no navegador: qualquer pessoa que abrir a página consegue lê-la.
> Para usar no seu computador, prefira a versão de terminal.

## Versão de terminal (`monitor_preco.py`)

```bash
pip install -r requirements.txt
cp .env.example .env          # preencha a ANTHROPIC_API_KEY (e o e-mail, se quiser)
set -a; . ./.env; set +a      # carrega o .env (Linux/macOS)
python monitor_preco.py
```

| Comando | O que faz |
|---|---|
| `/historico`, `/favoritos`, `/alertas` | Mostra as listas |
| `/favoritar` | Guarda o menor preço da última busca |
| `/add-alerta` | Cria um alerta (produto, loja, preço alvo e e-mail opcional) |
| `/remover-fav <n>`, `/remover-alerta <n>` | Tira um item da lista |
| `/nova` | Começa outra conversa |
| `/ajuda`, `/sair` | Ajuda e sair |

Histórico, favoritos e alertas ficam em `~/.garimpo.json` (só você lê: permissão 600). Para o alerta por e-mail,
preencha `SMTP_*` no `.env` — no Gmail, com uma *senha de app*.

## O que mudou nesta versão

- **Voltou a funcionar:** o modelo antigo (`claude-sonnet-4-20250514`) foi desligado pela Anthropic em junho de 2026.
  Agora usa o `claude-opus-5-5` com a busca na internet atual (`web_search_20260209`), retoma buscas longas
  (quando a API pausa no meio) e, na versão de terminal, tenta um modelo de reserva se o filtro de segurança recusar
  por engano. Cada busca é cobrada pela API da Anthropic; para gastar cerca de metade, troque `MODELO` por
  `claude-sonnet-5-5` no começo dos dois arquivos.
- **Segurança:**
  - links que não são `http`/`https` (como `javascript:`) são descartados;
  - o e-mail do alerta escapa o texto que veio da internet (antes dava para injetar HTML) e confere o certificado do
    servidor de e-mail (antes a senha podia ser capturada no caminho);
  - códigos de terminal escondidos em texto de página são tirados;
  - o assistente é instruído a ignorar ordens escritas dentro das páginas e a não inventar preço ou link;
  - preço e e-mail digitados são conferidos.
- **Contas certas:**
  - o "gráfico de 14 dias" mostrava números sorteados; saiu, e no lugar há barras com os preços reais e as suas buscas
    anteriores;
  - o alerta da tela disparava com qualquer produto; agora só com o do alerta;
  - o terminal não manda o mesmo e-mail duas vezes;
  - a tela não fica em branco quando a API dá erro: mostra o que fazer.
- **Guardado:** histórico, favoritos e alertas não somem mais ao fechar.
- **Visual:**
  - cores lisas, sem degradê, sombra ou desfoque, nem fontes baixadas de fora;
  - no celular, o painel abre por cima da conversa e as ofertas cabem na tela;
  - botões de 44 px, rótulos para leitor de tela, abas com setas e janela que fecha com Esc.
- **Arquivos que o README prometia e faltavam:** `requirements.txt`, `.env.example` e `.gitignore`.
  Testes da versão de terminal em `tests/`.

## Testes

```bash
python -m unittest      # não usam a internet nem a API
```

## Arquivos

`MonitorPreco.jsx` (versão com tela) · `monitor_preco.py` (versão de terminal) · `tests/` · `requirements.txt` ·
`.env.example` · `icone.svg`

## Licença

MIT
