# 🛒 Monitor de Preços

Comparador de preços inteligente com chat IA para **8 lojas brasileiras** — disponível em versão web (React) e terminal (Python).

## ✨ Funcionalidades

| Feature | Web | Terminal |
|---|:---:|:---:|
| Chat com IA (pede detalhes se necessário) | ✅ | ✅ |
| Busca em 8 lojas simultâneas | ✅ | ✅ |
| Filtro por loja e frete grátis | ✅ | — |
| Favoritos (até 5 itens) | ✅ | ✅ |
| Histórico de buscas | ✅ | ✅ |
| Alertas de queda de preço | ✅ (UI) | ✅ (e-mail real) |
| Gráfico de variação de preço | ✅ | — |
| 3 temas: Dark / Light / Noturno | ✅ | — |

**Lojas monitoradas:** Mercado Livre · Amazon Brasil · Magazine Luiza · Americanas · Shopee · Casas Bahia · Kabum · AliExpress

---

## 🚀 Versão Web (React)

### Pré-requisitos
- Node.js 18+
- Chave da API Anthropic

### Setup

```bash
npm create vite@latest monitor-preco -- --template react
cd monitor-preco
npm install recharts
```

Substitua o conteúdo de `src/App.jsx` pelo arquivo `MonitorPreco.jsx`.

```bash
npm run dev
```

> **Nota:** A chave da API Anthropic precisa estar configurada no proxy ou variável de ambiente do servidor. Em produção, nunca exponha a chave no frontend.

---

## 🖥️ Versão Terminal (Python)

### Pré-requisitos

```bash
pip install anthropic
```

### Configuração

```bash
# Obrigatório
export ANTHROPIC_API_KEY="sk-ant-..."

# Opcional — para alertas por e-mail reais
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USER="seuemail@gmail.com"
export SMTP_PASS="sua_senha_de_app"
```

### Executar

```bash
python monitor_preco.py
```

### Comandos disponíveis no terminal

| Comando | Descrição |
|---|---|
| `/historico` | Ver buscas anteriores |
| `/favoritos` | Ver produtos favoritos |
| `/favoritar` | Favoritar último resultado |
| `/add-alerta` | Criar alerta de preço |
| `/alertas` | Listar alertas ativos |
| `/remover-fav <n>` | Remover favorito pelo número |
| `/sair` | Encerrar o programa |

---

## 📁 Estrutura do Projeto

```
monitor-preco/
├── src/
│   └── MonitorPreco.jsx    # Versão web
├── monitor_preco.py        # Versão terminal
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

## 📋 requirements.txt

```
anthropic>=0.25.0
```

## 🔒 .gitignore

```
.env
node_modules/
dist/
__pycache__/
*.pyc
```

---

## 🤖 Como funciona a IA

O chat usa o modelo **Claude** com ferramenta de **busca web em tempo real**:

1. Se o produto for vago → pede mais detalhes (marca, modelo, tamanho, cor)
2. Com detalhes suficientes → busca em todas as 8 lojas simultaneamente
3. Retorna preços, parcelamentos, links e frete grátis

---

## 📄 Licença

MIT
