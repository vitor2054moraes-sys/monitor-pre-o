"""
monitor_preco.py — Monitor de Preços via Terminal
Usa a API da Anthropic com web search para buscar preços em 8 lojas brasileiras.

Instale as dependências:
    pip install anthropic

Configure sua chave:
    export ANTHROPIC_API_KEY="sk-..."
"""

import os
import json
import re
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    import anthropic
except ImportError:
    print("❌ Instale: pip install anthropic")
    exit(1)

# ─── CONFIG ──────────────────────────────────────────────────────────────────
STORES = [
    "Mercado Livre", "Amazon Brasil", "Magazine Luiza",
    "Americanas", "Shopee", "Casas Bahia", "Kabum", "AliExpress"
]

SYSTEM = f"""Você é um assistente especialista em comparação de preços online no Brasil.

Lojas que você DEVE pesquisar: {', '.join(STORES)}.

Regras:
1. Se o produto for vago (só categoria, sem modelo/marca), faça perguntas: marca, modelo, cor, tamanho, versão.
2. Só busque quando tiver detalhes suficientes para identificar o produto com precisão.
3. Ao buscar, procure em TODAS as {len(STORES)} lojas acima.
4. Responda SEMPRE em português.
5. Após buscar, retorne o JSON EXATAMENTE neste formato:

```json
{{
  "produto": "Nome completo e específico",
  "resultados": [
    {{
      "loja": "Nome da loja",
      "preco": 1299.99,
      "preco_formatado": "R$ 1.299,99",
      "link": "https://...",
      "disponivel": true,
      "frete_gratis": false,
      "parcelamento": "12x de R$ 108,33 sem juros"
    }}
  ]
}}
```

Inclua apenas lojas onde encontrou o produto."""

# ─── CORES ANSI ──────────────────────────────────────────────────────────────
class C:
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    DIM    = "\033[2m"
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    RED    = "\033[91m"
    BLUE   = "\033[94m"
    CYAN   = "\033[96m"
    ORANGE = "\033[38;5;208m"
    WHITE  = "\033[97m"

def c(text, *styles):
    return "".join(styles) + str(text) + C.RESET

def fmt_brl(value):
    try:
        return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except:
        return str(value)

# ─── PARSE JSON ──────────────────────────────────────────────────────────────
def parse_json(text):
    try:
        m = re.search(r'```json\n([\s\S]*?)\n```', text)
        if m:
            return json.loads(m.group(1))
        m = re.search(r'\{[\s\S]*"resultados"[\s\S]*\}', text)
        if m:
            return json.loads(m.group())
    except:
        pass
    return None

# ─── DISPLAY RESULTS ─────────────────────────────────────────────────────────
def display_results(data):
    print()
    print(c("═" * 62, C.DIM))
    print(c(f"  🛒 {data['produto']}", C.BOLD, C.WHITE))
    print(c("═" * 62, C.DIM))

    resultados = sorted(data["resultados"], key=lambda x: x.get("preco", 999999))
    if not resultados:
        print(c("  Nenhum resultado encontrado.", C.DIM))
        return

    min_price = resultados[0]["preco"]
    max_price = resultados[-1]["preco"]

    for r in resultados:
        is_best = r["preco"] == min_price
        prefix  = c("★ MELHOR  ", C.GREEN, C.BOLD) if is_best else "  " + c("○ ", C.DIM)
        loja    = c(r["loja"].ljust(18), C.CYAN if not is_best else C.GREEN)
        preco   = c(r.get("preco_formatado", fmt_brl(r["preco"])).ljust(16), C.GREEN if is_best else C.YELLOW, C.BOLD if is_best else "")

        linha = f"{prefix}{loja} {preco}"
        if r.get("frete_gratis"):
            linha += c(" ✓ Frete grátis", C.GREEN)
        if not r.get("disponivel", True):
            linha += c(" ⚠ Indisponível", C.RED)
        print(linha)

        if r.get("parcelamento"):
            print(f"    {c(r['parcelamento'], C.DIM)}")
        if r.get("link") and r["link"] != "#":
            print(f"    {c(r['link'][:60] + '...', C.DIM, C.BLUE) if len(r.get('link','')) > 60 else c(r['link'], C.DIM, C.BLUE)}")

        print()

    if len(resultados) > 1:
        economia = max_price - min_price
        print(c(f"  💡 Economia de até {fmt_brl(economia)} escolhendo o menor preço", C.YELLOW))

    print(c("═" * 62, C.DIM))

# ─── EMAIL ALERT ─────────────────────────────────────────────────────────────
def send_email_alert(to_email, produto, loja, preco):
    """
    Envia e-mail de alerta de preço.
    Configure SMTP_HOST, SMTP_USER e SMTP_PASS nas variáveis de ambiente.
    """
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")

    if not smtp_user or not smtp_pass:
        print(c("  ⚠  Configure SMTP_USER e SMTP_PASS para enviar e-mails.", C.YELLOW))
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🛒 Alerta de Preço: {produto}"
        msg["From"]    = smtp_user
        msg["To"]      = to_email

        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">
          <div style="background:#16a34a;color:#fff;padding:24px;">
            <h2 style="margin:0">🛒 Alerta de Preço Ativado!</h2>
          </div>
          <div style="padding:24px;">
            <p style="font-size:18px;font-weight:bold;color:#111">{produto}</p>
            <p style="font-size:14px;color:#555">Encontrado na loja <strong>{loja}</strong> por:</p>
            <p style="font-size:32px;color:#16a34a;font-weight:bold">{fmt_brl(preco)}</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
            <p style="font-size:12px;color:#aaa">Monitor de Preços · {datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
          </div>
        </div>
        """
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())
        return True
    except Exception as e:
        print(c(f"  ✗ Erro ao enviar e-mail: {e}", C.RED))
        return False

# ─── ALERT MANAGER ───────────────────────────────────────────────────────────
class AlertManager:
    def __init__(self):
        self.alerts = []  # [{produto, loja, target, email}]

    def add(self):
        print()
        produto = input(c("  Produto: ", C.CYAN)).strip()
        loja    = input(c("  Loja (Enter = qualquer): ", C.CYAN)).strip() or "Qualquer"
        target  = float(input(c("  Preço alvo (R$): ", C.CYAN)).strip().replace(",", "."))
        email   = input(c("  Seu e-mail: ", C.CYAN)).strip()
        self.alerts.append({"produto": produto, "loja": loja, "target": target, "email": email})
        print(c(f"  ✓ Alerta criado para {produto} abaixo de {fmt_brl(target)}", C.GREEN))

    def check(self, resultados, produto):
        for a in self.alerts:
            if a["produto"].lower() not in produto.lower():
                continue
            for r in resultados:
                if (a["loja"] == "Qualquer" or a["loja"] == r["loja"]) and r["preco"] <= a["target"]:
                    print()
                    print(c(f"  🔔 ALERTA! {produto} encontrado na {r['loja']} por {fmt_brl(r['preco'])}!", C.GREEN, C.BOLD))
                    sent = send_email_alert(a["email"], produto, r["loja"], r["preco"])
                    if sent:
                        print(c(f"  📧 E-mail enviado para {a['email']}", C.GREEN))

    def list_alerts(self):
        if not self.alerts:
            print(c("  Nenhum alerta configurado.", C.DIM))
            return
        for i, a in enumerate(self.alerts):
            print(c(f"  [{i+1}] {a['produto']} · {a['loja']} · abaixo de {fmt_brl(a['target'])} → {a['email']}", C.CYAN))

# ─── HISTORY ─────────────────────────────────────────────────────────────────
class History:
    def __init__(self):
        self.items = []

    def add(self, produto, menor_preco):
        self.items.insert(0, {
            "produto":     produto,
            "menor_preco": fmt_brl(menor_preco),
            "data":        datetime.now().strftime("%d/%m %H:%M")
        })
        self.items = self.items[:20]

    def show(self):
        if not self.items:
            print(c("  Nenhuma busca no histórico.", C.DIM))
            return
        print()
        for i, h in enumerate(self.items):
            print(c(f"  [{i+1}] ", C.DIM) + c(h["produto"], C.WHITE) + c(f" · {h['menor_preco']} · {h['data']}", C.DIM))

# ─── FAVORITES ───────────────────────────────────────────────────────────────
class Favorites:
    MAX = 5

    def __init__(self):
        self.items = []

    def add(self, resultados, produto):
        if len(self.items) >= self.MAX:
            print(c(f"  ⚠  Limite de {self.MAX} favoritos atingido.", C.YELLOW))
            return
        sorted_r = sorted(resultados, key=lambda x: x.get("preco", 999999))
        best = sorted_r[0]
        self.items.append({"produto": produto, **best})
        print(c(f"  ★ {produto} ({best['loja']}) adicionado aos favoritos!", C.GREEN))

    def show(self):
        if not self.items:
            print(c("  Nenhum favorito salvo.", C.DIM))
            return
        print()
        for i, f in enumerate(self.items):
            print(c(f"  [{i+1}] ", C.DIM) + c(f["produto"], C.WHITE) + c(f" · {f['loja']} · {f.get('preco_formatado', fmt_brl(f['preco']))}", C.YELLOW))

    def remove(self, idx):
        if 0 <= idx < len(self.items):
            removed = self.items.pop(idx)
            print(c(f"  ✓ {removed['produto']} removido dos favoritos.", C.DIM))

# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print(c("❌ Defina a variável ANTHROPIC_API_KEY", C.RED))
        exit(1)

    client   = anthropic.Anthropic(api_key=api_key)
    messages = []
    history  = History()
    favs     = Favorites()
    alarms   = AlertManager()
    last_results = None
    last_produto = None

    # Banner
    print()
    print(c("╔══════════════════════════════════════════════════════════╗", C.CYAN))
    print(c("║", C.CYAN) + c("          🛒  MONITOR DE PREÇOS  —  TERMINAL             ", C.BOLD, C.WHITE) + c("║", C.CYAN))
    print(c("║", C.CYAN) + c(f"          {len(STORES)} lojas · Chat IA · Alertas por e-mail       ", C.DIM) + c("║", C.CYAN))
    print(c("╚══════════════════════════════════════════════════════════╝", C.CYAN))
    print()
    print(c("  Comandos especiais:", C.DIM))
    print(c("  /historico  /favoritos  /alertas  /add-alerta  /favoritar  /sair", C.DIM))
    print()

    while True:
        try:
            user_input = input(c("Você: ", C.CYAN, C.BOLD)).strip()
        except (KeyboardInterrupt, EOFError):
            break

        if not user_input:
            continue

        # Comandos especiais
        cmd = user_input.lower()

        if cmd in ["/sair", "/exit", "/quit", "sair"]:
            print(c("\n  Até mais! 👋\n", C.DIM))
            break

        if cmd == "/historico":
            history.show()
            continue

        if cmd == "/favoritos":
            favs.show()
            continue

        if cmd == "/favoritar" and last_results:
            favs.add(last_results, last_produto)
            continue

        if cmd == "/alertas":
            alarms.list_alerts()
            continue

        if cmd == "/add-alerta":
            alarms.add()
            continue

        if cmd.startswith("/remover-fav "):
            try:
                idx = int(cmd.split()[-1]) - 1
                favs.remove(idx)
            except:
                print(c("  Uso: /remover-fav <número>", C.DIM))
            continue

        # Chat com IA
        messages.append({"role": "user", "content": user_input})

        print(c("\n  ◈ Buscando", C.DIM), end="", flush=True)
        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4000,
                system=SYSTEM,
                tools=[{"type": "web_search_20250305", "name": "web_search"}],
                messages=messages
            )

            reply = ""
            for block in response.content:
                if hasattr(block, "text"):
                    reply += block.text

            messages.append({"role": "assistant", "content": reply})

            parsed = parse_json(reply)
            if parsed and parsed.get("resultados"):
                display_results(parsed)
                alarms.check(parsed["resultados"], parsed["produto"])

                sorted_r = sorted(parsed["resultados"], key=lambda x: x.get("preco", 999999))
                history.add(parsed["produto"], sorted_r[0]["preco"])
                last_results = parsed["resultados"]
                last_produto = parsed["produto"]

                print(c("  Dica: /favoritar  /add-alerta  /historico  /favoritos", C.DIM))
            else:
                # Resposta de texto (pedindo mais detalhes)
                clean = re.sub(r'```json[\s\S]*?```', '', reply).strip()
                print()
                print(c("Assistente: ", C.GREEN, C.BOLD) + clean)

        except Exception as e:
            print(c(f"\n  ✗ Erro: {e}", C.RED))

        print()


if __name__ == "__main__":
    main()
