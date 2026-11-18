"""Testes da versão de terminal. Não usam a internet nem a API: o "cliente" é de mentira.

    python -m unittest
"""

import json
import os
import stat
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import monitor_preco as m


def bloco_texto(texto):
    return SimpleNamespace(type="text", text=texto)


class ClienteFalso:
    """Imita client.beta.messages.create devolvendo respostas prontas, em ordem."""

    def __init__(self, *respostas):
        self.respostas = list(respostas)
        self.pedidos = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **pedido):
        self.pedidos.append(pedido)
        return self.respostas.pop(0)


JSON_OK = """Achei em duas lojas.
```json
{"produto": "Fone Exemplo X1", "resultados": [
  {"loja": "Kabum", "preco": 199.9, "link": "https://exemplo.com/a", "frete_gratis": true},
  {"loja": "Shopee", "preco": "149.5", "link": "javascript:alert(1)", "parcelamento": "3x"},
  {"loja": "Amazon Brasil", "preco": -5},
  {"loja": "\\u001b[31mAmericanas", "preco": 180}
]}
```"""


class TestLeitura(unittest.TestCase):
    def test_resultados_conferidos_e_ordenados(self):
        r = m.extrair_resultados(JSON_OK)
        self.assertEqual([x["loja"] for x in r["resultados"]], ["Shopee", "Americanas", "Kabum"])
        self.assertEqual(r["resultados"][0]["link"], "", "link javascript: é descartado")
        self.assertEqual(r["resultados"][2]["link"], "https://exemplo.com/a")
        self.assertNotIn("\x1b", r["resultados"][1]["loja"], "código de terminal é tirado")

    def test_sem_json_ou_json_quebrado(self):
        self.assertIsNone(m.extrair_resultados("Qual o modelo e a cor?"))
        self.assertIsNone(m.extrair_resultados("```json\n{quebrado\n```"))
        self.assertIsNone(m.extrair_resultados('```json\n{"resultados": [{"loja": "Kabum", "preco": "abc"}]}\n```'))

    def test_json_sem_cerca(self):
        r = m.extrair_resultados('Veja: {"produto": "P", "resultados": [{"loja": "Kabum", "preco": 10}]} fim')
        self.assertEqual(r["resultados"][0]["preco"], 10)

    def test_precos_digitados(self):
        self.assertEqual(m.ler_preco("1.299,90"), 1299.9)
        self.assertEqual(m.ler_preco("R$ 1299,90"), 1299.9)
        self.assertEqual(m.ler_preco("1299.90"), 1299.9)
        self.assertIsNone(m.ler_preco("abc"))
        self.assertIsNone(m.ler_preco("-3"))
        self.assertIsNone(m.ler_preco("nan"))
        self.assertEqual(m.fmt_brl(1299.9), "R$ 1.299,90")

    def test_paragrafos_mantem_linhas_sem_controle(self):
        self.assertEqual(m.limpar_paragrafos("a\x1b[2J\n\n\n\nb\x1b]0;titulo\x07"), "a\n\nb")


class TestConversa(unittest.TestCase):
    def test_retoma_busca_pausada(self):
        pausa = SimpleNamespace(stop_reason="pause_turn", content=[bloco_texto("Pesquisando… ")])
        fim = SimpleNamespace(stop_reason="end_turn", content=[bloco_texto("pronto")])
        cliente = ClienteFalso(pausa, fim)
        resposta = m.perguntar(cliente, [], "fone X1")
        self.assertEqual(resposta.texto, "Pesquisando… pronto")
        segundo = cliente.pedidos[1]["messages"]
        self.assertEqual(segundo[-1]["role"], "assistant", "reenvia o que já veio, sem 'continue'")
        self.assertEqual(cliente.pedidos[0]["model"], "claude-opus-5-5")
        self.assertEqual(cliente.pedidos[0]["tools"][0]["type"], "web_search_20260209")
        self.assertEqual(cliente.pedidos[0]["fallbacks"], "default")

    def test_recusa_e_resposta_cortada(self):
        cliente = ClienteFalso(SimpleNamespace(stop_reason="refusal", content=[]))
        self.assertTrue(m.perguntar(cliente, [], "x").recusou)
        cliente = ClienteFalso(SimpleNamespace(stop_reason="max_tokens", content=[bloco_texto("meio")]))
        self.assertTrue(m.perguntar(cliente, [], "x").cortada)

    def test_para_depois_de_varias_pausas(self):
        pausas = [SimpleNamespace(stop_reason="pause_turn", content=[bloco_texto(".")])
                  for _ in range(m.MAX_CONTINUACOES + 1)]
        cliente = ClienteFalso(*pausas)
        resposta = m.perguntar(cliente, [], "x")
        self.assertTrue(resposta.cortada)
        self.assertEqual(len(cliente.pedidos), m.MAX_CONTINUACOES + 1)


class TestDados(unittest.TestCase):
    def setUp(self):
        self.pasta = tempfile.TemporaryDirectory()
        self.caminho = Path(self.pasta.name) / "garimpo.json"

    def tearDown(self):
        self.pasta.cleanup()

    def test_grava_so_para_o_dono_e_volta(self):
        dados = m.Dados(self.caminho)
        dados.registrar_busca(m.extrair_resultados(JSON_OK))
        dados.alertas.append({"produto": "fone exemplo", "loja": "Qualquer", "alvo": 150, "email": ""})
        self.assertTrue(dados.gravar())
        if os.name == "posix":
            self.assertEqual(stat.S_IMODE(self.caminho.stat().st_mode), 0o600)
        de_novo = m.Dados(self.caminho)
        self.assertEqual(de_novo.historico[0]["menor_preco"], 149.5)
        self.assertEqual(len(de_novo.alertas), 1)

    def test_arquivo_estragado_nao_derruba(self):
        self.caminho.write_text("{isto não é json", encoding="utf-8")
        dados = m.Dados(self.caminho)
        self.assertEqual(dados.historico, [])
        self.assertTrue(dados.aviso)
        self.caminho.write_text(json.dumps({"favoritos": [{"produto": "x", "preco": "caro"}, "lixo"]}), encoding="utf-8")
        self.assertEqual(m.Dados(self.caminho).favoritos, [])

    def test_alerta_so_do_produto_e_sem_repetir(self):
        dados = m.Dados(self.caminho)
        dados.alertas = [
            {"produto": "Fone Exemplo", "loja": "Qualquer", "alvo": 150},
            {"produto": "Outro Produto", "loja": "Qualquer", "alvo": 9999},
            {"produto": "fone exemplo", "loja": "Kabum", "alvo": 150},
        ]
        resultado = m.extrair_resultados(JSON_OK)
        disparos = dados.alertas_que_disparam(resultado)
        self.assertEqual(len(disparos), 1, "o alerta de outro produto e o da Kabum (199,90) não disparam")
        self.assertEqual(disparos[0][1]["loja"], "Shopee")
        self.assertEqual(dados.alertas_que_disparam(resultado), [], "o mesmo preço não avisa duas vezes")

    def test_favoritos_limite_e_repetido(self):
        dados = m.Dados(self.caminho)
        resultado = m.extrair_resultados(JSON_OK)
        dados.favoritar(resultado)
        self.assertIn("já está", dados.favoritar(resultado))
        for i in range(m.MAX_FAVORITOS):
            dados.favoritar({**resultado, "produto": f"Produto {i}"})
        self.assertEqual(len(dados.favoritos), m.MAX_FAVORITOS)


class TestEmail(unittest.TestCase):
    def test_html_escapado(self):
        msg = m.montar_email("eu@exemplo.com", "voce@exemplo.com", "<script>x</script>\nBcc: a@b.c",
                             "Loja <b>", 10, 'https://exemplo.com/?a="><img>')
        html_parte = msg.get_body(("html",)).get_content()
        self.assertNotIn("<script>", html_parte)
        self.assertIn("&lt;script&gt;", html_parte)
        self.assertNotIn('"><img>', html_parte)
        self.assertNotIn("\n", msg["Subject"], "quebra de linha não vira outro cabeçalho")
        self.assertIsNone(msg["Bcc"])

    def test_sem_configuracao_nao_tenta_enviar(self):
        antigo = {k: os.environ.pop(k, None) for k in ("SMTP_USER", "SMTP_PASS")}
        try:
            self.assertIn("configure", m.enviar_email("voce@exemplo.com", "P", "L", 10))
        finally:
            os.environ.update({k: v for k, v in antigo.items() if v is not None})


if __name__ == "__main__":
    unittest.main()
