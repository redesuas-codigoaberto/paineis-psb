# Mapa de Adesão — versão estática sem servidor

Esta versão não depende de servidor nenhum, nem para atualizar nem para
abrir a página. Os dados ficam embutidos direto dentro do `index.html`.

## Estrutura

```
atualizar_dados.py   # rode isso quando tiver planilha nova
parser.py             # lógica de leitura do xlsx (usado pelo script acima)
state_pages.py         # gera as páginas individuais por UF
geo_brasil.json        # geometria do mapa (não muda, não tem dado de adesão)
site/
  index.html           # painel nacional — abra direto no navegador
site_por_uf/
  AC.html, AL.html...  # uma página por estado, só com os dados daquele UF
historico/             # cópia de cada planilha + json gerado, com timestamp
```

## Atualizar os dados

```bash
python3 atualizar_dados.py "caminho/para/planilha_do_dia.xlsx"
```

Isso lê a planilha e:
1. Reescreve só o bloco de dados dentro de `site/index.html` (painel
   nacional, com todos os estados — o resto do arquivo não muda).
2. Gera/atualiza `site_por_uf/<UF>.html` para os 27 estados — cada um com
   só os dados daquele estado embutidos.
3. Guarda uma cópia da planilha e do JSON gerado em `historico/`, com
   timestamp.

Se quiser pular a geração das páginas por UF (só atualizar o painel
nacional, mais rápido):
```bash
python3 atualizar_dados.py "caminho/para/planilha.xlsx" --sem-paginas-uf
```

Se quiser automatizar (Agendador de Tarefas do Windows, cron, etc.), é
literalmente o mesmo comando, apontando pro arquivo que chega todo dia.

## Páginas individuais por UF

Cada arquivo em `site_por_uf/<UF>.html` (ex: `site_por_uf/BA.html`) é
autocontido e mostra só:
- KPIs daquele estado (municípios que aderiram, %, meta física aceita)
- Mapa do Brasil com aquele estado destacado, os demais em cinza neutro
  (sem número nenhum associado a eles no código)
- Lista dos municípios que aderiram naquele estado
- Uma linha de contexto nacional agregado (total Brasil, sem detalhar
  outros estados individualmente)

**Importante — o que isso é e o que não é**: é uma forma prática de mandar
para cada estado só o que interessa a ele, sem que precise abrir o painel
nacional inteiro. Não é controle de acesso de verdade — qualquer pessoa que
receber o arquivo `BA.html`, por exemplo, só vai encontrar dados da Bahia
ali dentro (confirmei isso: o JSON embutido no arquivo não contém a chave
de nenhum outro estado). Mas nada impede alguém de compartilhar o link de
um estado com outra pessoa, ou de pedir diretamente o painel nacional para
ver todo mundo. Se um dia isso precisar virar restrição de acesso de
verdade (um estado logicamente impedido de ver o painel de outro mesmo
tentando), isso exige login por usuário e um backend — é uma reformulação
bem maior, avise se chegar a esse ponto.

## Abrir a página

**Só dar duplo clique** em `site/index.html` (painel nacional) ou em
`site_por_uf/<UF>.html` (painel de um estado). Não precisa de servidor, não
precisa de porta — os dados já estão dentro do arquivo.

Se quiser publicar isso em algum lugar acessível pela rede interna (em vez
de só na sua máquina), qualquer servidor estático de arquivo serve — mas
isso é opcional, não é necessário para usar.

## Formato esperado da planilha

Aba com cabeçalho nas primeiras 5 linhas contendo pelo menos `UF`, `Ente`,
`Meta Física`, `Resposta à Oferta`. `Meta Física Aceita` é opcional. Uma
linha conta como "aderiu" quando `Resposta à Oferta` contém "aceit" (sem
diferenciar maiúsculas/acentos) — cobre "Aceita", "Aceito" etc.

## Se o script reclamar de "marcador não encontrado"

Isso acontece se o `site/index.html` foi editado manualmente e o trecho
```
/*__DATA_JSON_START__*/ ... /*__DATA_JSON_END__*/
```
foi alterado ou removido. Não edite esse bloco à mão — ele é reescrito
inteiro a cada execução do script. Se isso acontecer, pegue de novo o
`index.html` original (por exemplo do zip que você baixou) e rode o script
novamente.

## Sobre dados sensíveis

O parser nunca lê a coluna de CPF da planilha original — ela não entra em
nenhum arquivo gerado por este projeto (nem `site/index.html`, nem
`site_por_uf/*.html`). A pasta `historico/` guarda a planilha original
inteira (essa sim com CPF); trate essa pasta com o mesmo nível de restrição
de acesso da planilha — não compartilhe `historico/`, só os arquivos dentro
de `site/` e `site_por_uf/` são para circular.
