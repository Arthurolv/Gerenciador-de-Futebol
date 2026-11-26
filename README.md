# ⚽ Gestor FC

Jogo web de gerenciamento de futebol inspirado em Football Manager, Brasfoot e Elifoot. Crie seu clube, comece na **Série D** e construa a trajetória até a elite nacional.

Tudo roda no navegador, em um único arquivo (`index.html`), sem dependências nem build.

## Capturas de tela

| Criação do clube | Visão geral |
|---|---|
| ![Criar clube](docs/criar-clube.png) | ![Visão geral](docs/visao-geral.png) |

| Competições | Elenco |
|---|---|
| ![Competições](docs/competicoes.png) | ![Elenco](docs/elenco.png) |

![Táticas](docs/taticas.png)

## Como executar

**Opção 1 — direto:** abra o `index.html` no navegador.

**Opção 2 — servidor local:**

```bash
python3 -m http.server 8080
# acesse http://localhost:8080
```

**Opção 3 — GitHub Pages:** envie o repositório, vá em *Settings → Pages* e selecione a branch `main` (pasta `/root`). O jogo ficará online em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

## Como jogar

1. Crie o clube: nome, sigla, cidade, estádio, cores, escudo, filosofia de jogo e objetivo da diretoria.
2. Monte o elenco no **Mercado** (jogadores livres e de outros clubes) e ajuste a **Tática**.
3. Clique em **Jogar rodada**. Acompanhe o relato ao vivo ou clique em *Pular*.
4. Fique entre os 2 primeiros para subir de divisão. Ao fim das 14 rodadas, clique em **Encerrar temporada**.
5. Administre finanças, base, treino e instalações para crescer até a Série A.

## Funcionalidades

- 4 divisões (Séries A–D) com 8 clubes cada, calendário de ida e volta, tabela, artilharia, acesso e rebaixamento.
- Motor de partidas com distribuição de Poisson: força do time, tática, formação (4-3-3, 4-4-2, 4-2-3-1, 3-5-2), condição física, moral, treinador e mando de campo; gols, assistências, cartões e lesões.
- Elenco com atributos, idade, potencial, contrato, salário e valor; envelhecimento, evolução, lesões e aposentadoria.
- Mercado com janelas, contraproposta, luvas, propostas recebidas, renovação e liberação.
- Categorias de base com potencial oculto (estrelas do olheiro), promoção, empréstimo e venda.
- Treinamento (foco e intensidade), finanças (bilheteria, TV, patrocínio, folha, prêmios), estádio e instalações.
- Diretoria, torcida, reputação, notícias e histórico de temporadas e títulos.
- IA dos clubes: evolução de elencos, troca de treinadores e substituição de aposentados.
- Salvamento automático em `localStorage`.

## Estrutura

```
index.html   # jogo completo (HTML + CSS + JS)
README.md
docs/        # capturas de tela
```

Dentro do `index.html`, o JavaScript está organizado por blocos: geração de dados, tabela e calendário, simulação (`strg`, `simMatch`), rodada e temporada (`playRound`, `after`, `endSeason`), ações do usuário (`buy`, `sell`, `renew`, `up`, `youth`) e telas (`V`).

## Limitações atuais

- Salvamento local do navegador: sem contas de usuário, back-end Node ou PostgreSQL.
- Ainda não há Copa nacional, torneios continentais, estaduais, substituições durante a partida nem escalação manual.

## Roadmap

- [ ] Copa nacional e torneios continentais
- [ ] Escalação manual e substituições
- [ ] Back-end Node.js + PostgreSQL com autenticação
- [ ] Atributos detalhados dos jogadores (velocidade, finalização, passe...)
- [ ] Gráficos adicionais e exportação de saves

## Licença

Defina a licença de sua preferência (ex.: MIT). Todos os nomes de clubes e jogadores são fictícios.
